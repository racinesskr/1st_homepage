const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const gradeCollator = new Intl.Collator('ko', { numeric: true });
const elementaryTones = ['yellow', 'orange', 'green', 'sky', 'light-sky', 'purple'];

function timeLabel(row) {
  return row.end ? `${row.start}–${row.end}` : row.start;
}

function gradeLabels(grade) {
  return [...new Set(grade.split(',').map(label => label.trim()).filter(Boolean))];
}

function shortGrade(label) {
  return label
    .replace(/^(초|중|고)(?:등(?:학교|부)?|학교)?\s*(?=\d)/, '$1')
    .replace(/\s*학년/g, '');
}

function gradeTone(label) {
  if (/^7\s*세$/.test(label)) return 'pink';
  if (/^중/.test(label)) return 'ivory';
  const elementary = label.match(/^(?:초(?:등(?:학교|부)?)?\s*)?([1-6])\s*학년$/);
  return elementary ? elementaryTones[Number(elementary[1]) - 1] : 'neutral';
}

function colorEntry(entry, grade, name = '') {
  const tones = name.replace(/\s/g, '').startsWith('교과수학') ? ['ivory'] :
    [...new Set(gradeLabels(grade).map(gradeTone))];
  if (!tones.length) return;
  const colors = tones.map(tone => `var(--grade-${tone})`);
  const fill = colors.length === 1 ? colors[0] : `linear-gradient(110deg, ${colors.join(', ')})`;
  entry.style.setProperty('--grade-fill', fill);
}

function addRowHeading(line, label) {
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  line.append(heading);
  return heading;
}

function programName(label) {
  const name = document.createElement('strong');
  const compactName = 'CNI 통합과학 G';
  if (label === compactName || label === compactName + ' (속성)') {
    const title = document.createElement('span');
    title.className = 'compact-cni-name';
    const detail = document.createElement('span');
    detail.className = 'compact-cni-detail';
    detail.textContent = '통합과학 G';
    title.append('CNI ', detail);
    name.append(title, label.slice(compactName.length));
  } else {
    name.textContent = label;
  }
  return name;
}

function renderByDay(rows, table, selectedGrade) {
  const slots = new Map();
  for (const row of rows) {
    const time = row.start;
    if (!slots.has(time)) slots.set(time, Array.from({ length: 7 }, () => []));
    slots.get(time)[row.day - 1].push(row);
  }
  for (const [time, days] of [...slots].sort(([a], [b]) => a.localeCompare(b))) {
    const line = table.insertRow();
    addRowHeading(line, time);
    for (const classes of days) {
      const cell = line.insertCell();
      for (const row of classes) {
        const entry = document.createElement('p');
        entry.className = 'class-entry';
        entry.title = row.subject;
        colorEntry(entry, selectedGrade || row.grade, row.name);
        const name = programName(row.name);
        const detail = document.createElement('small');
        const grades = gradeLabels(row.grade).map(shortGrade).join('·');
        detail.textContent = [row.subject, grades, row.end ? `${row.end}까지` : ''].filter(Boolean).join(' · ');
        entry.append(name, detail);
        cell.append(entry);
      }
      if (!classes.length) cell.textContent = '–';
    }
  }
}

function subjectColumn(subject) {
  const science = subject.includes('과학');
  const math = subject.includes('수학');
  if (science && !math) return '과학';
  if (math && !science) return '수학';
  return '기타';
}

function schoolLevel(grade) {
  if (/유치|\d+\s*세/.test(grade)) return 0;
  if (/^중/.test(grade)) return 2;
  if (/^고/.test(grade)) return 3;
  if (/^초|^\d+\s*학년/.test(grade)) return 1;
  return 4;
}

function compareGrades(a, b) {
  return schoolLevel(a) - schoolLevel(b) || gradeCollator.compare(a, b);
}

function formatProgramSlots(slots) {
  const groups = new Map();
  for (const [day, times] of [...slots].sort(([a], [b]) => a - b)) {
    const label = [...times].sort().join(', ');
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(weekdays[day - 1]);
  }
  return groups;
}

function renderPrograms(cell, rows, subject, grade) {
  const programs = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.name, row.subject]);
    if (!programs.has(key)) programs.set(key, { name: row.name, subject: row.subject, slots: new Map() });
    const { slots } = programs.get(key);
    const time = timeLabel(row);
    if (!slots.has(row.day)) slots.set(row.day, new Set());
    slots.get(row.day).add(time);
  }
  if (!programs.size) cell.textContent = '–';
  for (const program of programs.values()) {
    const entry = document.createElement('p');
    entry.className = 'program-entry';
    colorEntry(entry, grade, program.name);
    entry.append(programName(program.name));
    if (program.subject !== subject) {
      const detail = document.createElement('small');
      detail.textContent = ` · ${program.subject}`;
      entry.append(detail);
    }
    for (const [time, days] of formatProgramSlots(program.slots)) {
      const slot = document.createElement('span');
      slot.className = 'program-slot';
      const dayNames = document.createElement('b');
      dayNames.textContent = days.join('·');
      const times = document.createElement('span');
      times.className = 'program-times';
      times.textContent = time;
      slot.append(dayNames, times);
      entry.append(slot);
    }
    cell.append(entry);
  }
}

function renderByGrade(rows, table, otherHeading) {
  const grades = new Map();
  const subjects = ['과학', '수학'];
  let hasOther = false;
  for (const row of rows) {
    const subject = subjectColumn(row.subject);
    for (const grade of gradeLabels(row.grade)) {
      if (!grades.has(grade)) grades.set(grade, []);
      grades.get(grade).push({ row, subject });
    }
    if (subject === '기타') hasOther = true;
  }
  otherHeading.hidden = !hasOther;
  if (hasOther) subjects.push('기타');
  const labels = [...grades.keys()].sort(compareGrades);
  for (const grade of labels) {
    const line = table.insertRow();
    colorEntry(addRowHeading(line, shortGrade(grade)), grade);
    for (const subject of subjects) {
      const classes = grades.get(grade).filter(item => item.subject === subject).map(item => item.row);
      renderPrograms(line.insertCell(), classes, subject, grade);
    }
  }
}

function createScheduleView(root) {
  const views = root.querySelector('#schedule-views');
  const buttons = [...views.querySelectorAll('button')];
  const panels = new Map(buttons.map(button => [
    button.dataset.scheduleView, root.querySelector('#' + button.getAttribute('aria-controls'))
  ]));
  const status = root.querySelector('#schedule-status');
  const heading = root.querySelector('#schedule-heading');
  const filter = root.querySelector('#schedule-filter');
  const gradeSelect = root.querySelector('#schedule-grade');
  const updated = root.querySelector('#updated');
  const dayRows = root.querySelector('#schedule-rows');
  const gradeRows = root.querySelector('#grade-rows');
  const otherHeading = root.querySelector('#grade-other');
  const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });
  let selected = 'day';
  let scheduleRows = [];

  function showSelected() {
    for (const [view, panel] of panels) panel.hidden = views.hidden || view !== selected;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.scheduleView === selected));
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      selected = button.dataset.scheduleView;
      showSelected();
    });
  }

  function renderTables() {
    dayRows.replaceChildren();
    gradeRows.replaceChildren();
    const grade = gradeSelect.value;
    const visible = grade ? scheduleRows.filter(row => gradeLabels(row.grade).includes(grade)) : scheduleRows;
    renderByDay(visible, dayRows, grade);
    renderByGrade(grade ? visible.map(row => ({ ...row, grade })) : visible, gradeRows, otherHeading);
  }

  gradeSelect.addEventListener('change', renderTables);

  return ({ rows, title, updatedAt }) => {
    scheduleRows = rows;
    heading.textContent = title || '수업 시간표 보기';
    const previousGrade = gradeSelect.value;
    const grades = [...new Set(rows.flatMap(row => gradeLabels(row.grade)))].sort(compareGrades);
    gradeSelect.options.length = 1;
    for (const grade of grades) gradeSelect.add(new Option(shortGrade(grade), grade));
    gradeSelect.value = grades.includes(previousGrade) ? previousGrade : '';
    views.hidden = !rows.length;
    filter.hidden = !rows.length;
    renderTables();
    updated.textContent = updatedAt ? `업데이트 ${date.format(new Date(updatedAt))}` : '';
    status.textContent = rows.length ? '휴대폰에서는 표를 좌우로 밀어 볼 수 있습니다.' :
      '공개된 시간표가 아직 없습니다. 수업 시간은 센터로 문의해 주세요.';
    showSelected();
  };
}

const renderSchedule = createScheduleView(document);

async function loadSchedule() {
  const response = await fetch('/api/schedule', { cache: 'no-store' });
  if (!response.ok) throw new Error('Schedule unavailable');
  renderSchedule(await response.json());
}

loadSchedule().catch(() => {
  document.querySelector('#schedule-status').textContent =
    '시간표를 불러오지 못했습니다. 잠시 후 다시 시도하거나 센터에 문의해 주세요.';
});
