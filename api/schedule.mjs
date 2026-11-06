import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { BlobPreconditionFailedError, get, put } from '@vercel/blob';
import { novemberRows, novemberTitle } from '../schedule/november-reference.js';

const pathname = 'schedule/weekly.json';
const credentialsPath = 'schedule/admin.json';
const deriveKey = promisify(scrypt);
const lifetime = 60 * 60 * 4;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const hash = value => createHash('sha256').update(value).digest();
const equal = (left, right) => timingSafeEqual(hash(left), hash(right));
const sign = (value, secret) => createHmac('sha256', secret).update('schedule:' + value).digest('base64url');

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function validSession(request, secret) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\d{1,12}\.[\w-]{24})\.([\w-]{43})$/);
  return token && Number(token[1].split('.')[0]) > Date.now() / 1000 && equal(token[2], sign(token[1], secret));
}

async function readCredentials() {
  const blob = await get(credentialsPath, { access: 'private', useCache: false });
  return blob ? new Response(blob.stream).json() : null;
}

async function login(request, setupCode, credentials) {
  const data = await requestJson(request, 2048);
  if (typeof data?.password !== 'string' || data.password.length > 128) {
    return json({ error: '관리자 비밀번호를 확인해 주세요.' }, 401);
  }
  if (!credentials) {
    if (data.password !== '1234') return json({ error: '초기 비밀번호를 확인해 주세요.' }, 401);
    if (data.newPassword === undefined) return json({ setupRequired: true });
    if (typeof data.setupCode !== 'string' || !equal(data.setupCode, setupCode)) {
      return json({ error: '최초 설정 코드를 확인해 주세요.' }, 401);
    }
    if (typeof data.newPassword !== 'string' || data.newPassword.length < 8 || data.newPassword.length > 128 ||
        !data.newPassword.trim() || equal(data.newPassword, setupCode)) {
      return json({ error: '설정 코드와 다른 8~128자 비밀번호를 입력해 주세요.' }, 400);
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await deriveKey(data.newPassword, salt, 64)).toString('hex');
    try {
      await put(credentialsPath, JSON.stringify({ salt, passwordHash }), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false
      });
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) && !/already exists/i.test(error?.message ?? '')) throw error;
      return json({ error: '최초 설정이 이미 완료됐습니다. 로그인 화면으로 돌아가 주세요.' }, 409);
    }
    return json({ configured: true });
  }
  if (data.newPassword !== undefined) return json({ error: '최초 설정이 이미 완료됐습니다.' }, 409);
  const passwordHash = await deriveKey(data.password, credentials.salt, 64);
  if (!equal(passwordHash, Buffer.from(credentials.passwordHash, 'hex'))) {
    return json({ error: '관리자 비밀번호를 확인해 주세요.' }, 401);
  }
  const payload = `${Math.floor(Date.now() / 1000) + lifetime}.${randomBytes(18).toString('base64url')}`;
  return json({ token: `${payload}.${sign(payload, setupCode + credentials.passwordHash)}` });
}

async function readSchedule() {
  const blob = await get(pathname, { access: 'private', useCache: false });
  if (!blob) return { rows: novemberRows, title: novemberTitle, updatedAt: null, version: null };
  const data = await new Response(blob.stream).json();
  return { rows: data.rows, title: data.title ?? '', updatedAt: data.updatedAt, version: blob.blob.etag };
}

function cleanRows(rows) {
  if (!Array.isArray(rows) || rows.length > 150) return null;
  const clean = [];
  for (const row of rows) {
    if (!row || !Number.isInteger(row.day) || row.day < 1 || row.day > 7) return null;
    const end = row.end ?? '';
    if (typeof row.start !== 'string' || !timePattern.test(row.start) || typeof end !== 'string' ||
        (end && (!timePattern.test(end) || row.start >= end))) return null;
    const details = {};
    for (const field of ['subject', 'grade', 'name']) {
      if (typeof row[field] !== 'string') return null;
      details[field] = row[field].trim();
      if (!details[field] || details[field].length > 60) return null;
    }
    clean.push({ day: row.day, start: row.start, end, ...details });
  }
  return clean.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'ko'));
}

async function requestJson(request, limit) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return null;
  const body = await request.text();
  if (body.length > limit) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function handler(request) {
  const secret = process.env.SCHEDULE_ADMIN_SETUP_CODE ?? process.env.SCHEDULE_ADMIN_PASSWORD;
  const url = new URL(request.url);
  try {
    if (request.method === 'GET' && !url.searchParams.has('edit')) {
      const { rows, title, updatedAt } = await readSchedule();
      return json({ rows, title, updatedAt });
    }

    if (!secret || !/^[A-Za-z0-9_-]{32,}$/.test(secret)) {
      return json({ error: '관리자 설정이 필요합니다.' }, 503);
    }
    if (request.method === 'POST' || request.method === 'PUT') {
      if (request.headers.get('origin') !== url.origin) return json({ error: '허용되지 않은 요청입니다.' }, 403);
    }
    const credentials = await readCredentials();
    if (request.method === 'POST') return await login(request, secret, credentials);
    if (!credentials || !validSession(request, secret + credentials.passwordHash)) {
      return json({ error: '관리자 로그인이 필요합니다.' }, 401);
    }
    if (request.method === 'GET') return json(await readSchedule());
    if (request.method !== 'PUT') return json({ error: '지원하지 않는 요청입니다.' }, 405);

    const data = await requestJson(request, 100_000);
    const rows = cleanRows(data?.rows);
    const title = data?.title ?? '';
    if (!rows || typeof title !== 'string' || title.length > 60 ||
        (data.version !== null && typeof data.version !== 'string')) {
      return json({ error: '입력 내용을 확인해 주세요. 종료 시간은 시작 시간 이후여야 합니다.' }, 400);
    }
    const current = await readSchedule();
    if (data.version !== current.version) {
      return json({ error: '다른 곳에서 먼저 공개했습니다. 현재 공개본을 다시 불러와 주세요.' }, 409);
    }
    const updatedAt = new Date().toISOString();
    const schedule = { rows, title: title.trim(), updatedAt };
    const saved = await put(pathname, JSON.stringify(schedule), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: current.version !== null,
      ...(current.version ? { ifMatch: current.version } : {})
    });
    return json({ ...schedule, version: saved.etag });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError || /already exists/i.test(error?.message ?? '')) {
      return json({ error: '다른 곳에서 먼저 공개했습니다. 현재 공개본을 다시 불러와 주세요.' }, 409);
    }
    return json({ error: '시간표 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }, 503);
  }
}

export default { fetch: handler };
