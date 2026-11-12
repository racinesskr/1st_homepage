import { novemberRows, novemberTitle } from '/schedule/november-reference.js';

const login = document.querySelector('#login');
const setup = document.querySelector('#setup');
const editor = document.querySelector('#editor');
const rows = document.querySelector('#rows');
const status = document.querySelector('#status');
const add = document.querySelector('#add');
const fields = ['day', 'start', 'end', 'subject', 'grade', 'name'];
const monicaOrigin = 'https://admin.hawhy.net';
const embedded = window.parent !== window && new URLSearchParams(location.search).get('monica') === '1';
let token;

function getMonicaToken() {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error('모니카 원장 계정 로그인을 확인해 주세요.'));
    }, 8000);

    function receive(event) {
      if (event.origin !== monicaOrigin || event.source !== window.parent ||
          event.data?.type !== 'monica-schedule-session' || event.data.id !== id) return;
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      if (typeof event.data.token === 'string' && event.data.token) resolve(event.data.token);
      else reject(new Error('모니카 원장 계정 로그인을 확인해 주세요.'));
    }

    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'monica-schedule-session-request', id }, monicaOrigin);
  });
}
let version;
let dirty = false;

function report(message, error = false) {
  status.toggleAttribute('data-error', error);
  status.textContent = message;
}

async function request(method, body, query = '') {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const accessToken = embedded ? await getMonicaToken() : token;
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const response = await fetch('/api/schedule' + query, {
    method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok) {
    if (!embedded && response.status === 401 && token) {
      token = undefined;
      login.hidden = false;
      login.elements.password.focus();
    }
    throw new Error(data.error);
  }
  return data;
}

function addRow(values) {
  const fragment = document.querySelector('#row-template').content.cloneNode(true);
  const row = fragment.querySelector('fieldset');
  if (values) {
    for (const field of fields) row.querySelector(`[name="${field}"]`).value = values[field] ?? '';
  }
  row.querySelector('.remove').addEventListener('click', () => {
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    dirty = true;
    (next?.querySelector('select') || add).focus();
  });
  rows.append(fragment);
  if (!values) row.querySelector('select').focus();
}

function show(data) {
  version = data.version;
  editor.elements.scheduleTitle.value = data.title ?? '';
  rows.replaceChildren();
  data.rows.forEach(addRow);
  dirty = false;
  editor.hidden = false;
}

async function run(form, action) {
  const controls = [...form.elements].filter(control => !control.disabled);
  controls.forEach(control => { control.disabled = true; });
  report('처리 중입니다…');
  try {
    await action();
  } catch (error) {
    report(error.message === 'Failed to fetch' ? '연결을 확인한 뒤 다시 시도해 주세요.' : error.message, true);
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
}

login.addEventListener('submit', event => {
  event.preventDefault();
  const password = login.elements.password.value;
  login.reset();
  run(login, async () => {
    const result = await request('POST', { password });
    if (result.setupRequired) {
      login.hidden = true;
      setup.hidden = false;
      report('최초 설정 코드와 앞으로 사용할 비밀번호를 입력해 주세요.');
      setup.elements.setupCode.focus();
      return;
    }
    token = result.token;
    if (!dirty) show(await request('GET', undefined, '?edit'));
    login.hidden = true;
    report(dirty ? '다시 로그인했습니다. 수정한 내용을 공개할 수 있습니다.' : '공개 시간표를 불러왔습니다.');
    add.focus();
  });
});

document.querySelector('#back-to-login').addEventListener('click', () => {
  setup.reset();
  setup.hidden = true;
  login.hidden = false;
  report('');
  login.elements.password.focus();
});

setup.addEventListener('submit', event => {
  event.preventDefault();
  const { setupCode, newPassword, confirmPassword } = setup.elements;
  if (newPassword.value !== confirmPassword.value) {
    report('새 비밀번호와 확인 값이 일치하지 않습니다.', true);
    confirmPassword.focus();
    return;
  }
  const body = { password: '1234', setupCode: setupCode.value, newPassword: newPassword.value };
  run(setup, async () => {
    await request('POST', body);
    setup.reset();
    setup.hidden = true;
    login.hidden = false;
    report('새 비밀번호를 설정했습니다. 새 비밀번호로 로그인해 주세요.');
    login.elements.password.focus();
  });
});

add.addEventListener('click', () => {
  if (rows.children.length >= 150) return report('수업은 최대 150개까지 추가할 수 있습니다.', true);
  addRow();
  dirty = true;
});
editor.addEventListener('input', () => { dirty = true; });

document.querySelector('#import-november').addEventListener('click', () => {
  if ((rows.children.length || dirty) && !confirm('편집 화면을 11월 시간표로 바꿀까요? 공개본은 공개 버튼을 눌러야 바뀝니다.')) return;
  show({ rows: novemberRows, title: novemberTitle, version });
  dirty = true;
  report(`11월 시간표의 수업 ${novemberRows.length}개를 불러왔습니다. 확인 후 공개해 주세요.`);
});

document.querySelector('#reload').addEventListener('click', () => {
  if (dirty && !confirm('작성 중인 내용이 사라집니다. 현재 공개본을 다시 불러올까요?')) return;
  run(editor, async () => {
    show(await request('GET', undefined, '?edit'));
    report('현재 공개본을 불러왔습니다.');
  });
});
document.querySelector('#logout').addEventListener('click', () => {
  if (dirty && !confirm('작성 중인 내용이 사라집니다. 로그아웃할까요?')) return;
  token = undefined;
  dirty = false;
  rows.replaceChildren();
  editor.hidden = true;
  login.hidden = false;
  report('로그아웃했습니다.');
  login.elements.password.focus();
});

editor.addEventListener('submit', event => {
  event.preventDefault();
  const data = [...rows.children].map(row => {
    const values = Object.fromEntries(fields.map(field => [field, row.querySelector(`[name="${field}"]`).value]));
    return { ...values, day: Number(values.day) };
  });
  if (data.some(row => row.end && row.start >= row.end)) return report('종료 시간은 시작 시간보다 뒤여야 합니다.', true);
  const prompt = data.length ? `수업 ${data.length}개를 공개할까요?` : '모든 수업을 공개 시간표에서 내릴까요?';
  if (!confirm(prompt)) return;
  run(editor, async () => {
    show(await request('PUT', { rows: data, title: editor.elements.scheduleTitle.value, version }));
    report('시간표를 공개했습니다.');
  });
});
window.addEventListener('beforeunload', event => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = true;
  }
});
if (embedded) {
  document.querySelector('#logout').hidden = true;
  report('모니카 로그인 확인 중…');
  request('GET', undefined, '?edit').then(data => {
    show(data);
    report('');
  }).catch(error => report(error.message, true));
} else {
  login.hidden = false;
}
