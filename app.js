'use strict';

const STORAGE_KEY = 'classtrack-v1';

const emptyDatabase = () => ({
  students: [],
  attendance: {},
  marks: []
});

function loadDatabase() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      saved &&
      Array.isArray(saved.students) &&
      saved.attendance &&
      Array.isArray(saved.marks)
    ) {
      return saved;
    }
  } catch (error) {
    console.warn('Could not read the saved ClassTrack data.', error);
  }

  return emptyDatabase();
}

let db = loadDatabase();

const $ = (id) => document.getElementById(id);

function saveDatabase() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function makeCell(value) {
  const cell = document.createElement('td');
  cell.textContent = String(value);
  return cell;
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function render() {
  $('count').textContent = db.students.length;

  const todayRecord = db.attendance[localDateValue()] || {};
  const recordedStudents = db.students.filter((student) => {
    return ['Present', 'Absent'].includes(todayRecord[student.id]);
  });
  const presentCount = recordedStudents.filter((student) => {
    return todayRecord[student.id] === 'Present';
  }).length;

  $('present').textContent = presentCount;
  $('rate').textContent = recordedStudents.length
    ? Math.round((presentCount / recordedStudents.length) * 100) + '%'
    : '—';

  renderStudents();
  renderSelectors();
  renderAttendance();
  renderMarks();
}

function renderStudents() {
  const rows = $('studentRows');
  const query = $('search').value.trim().toLowerCase();

  rows.replaceChildren();

  const matchingStudents = db.students.filter((student) => {
    const searchableText = [
      student.name,
      student.roll,
      student.className
    ].join(' ').toLowerCase();

    return searchableText.includes(query);
  });

  for (const student of matchingStudents) {
    const row = document.createElement('tr');

    [student.roll, student.name, student.className].forEach((value) => {
      row.append(makeCell(value));
    });

    const actionCell = makeCell('');
    const deleteButton = document.createElement('button');

    deleteButton.className = 'danger';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      if (!confirm('Delete this student and all their records?')) return;

      db.students = db.students.filter((item) => item.id !== student.id);
      db.marks = db.marks.filter((mark) => mark.studentId !== student.id);

      for (const attendanceRecord of Object.values(db.attendance)) {
        delete attendanceRecord[student.id];
      }

      saveDatabase();
      render();
    });

    actionCell.append(deleteButton);
    row.append(actionCell);
    rows.append(row);
  }
}

function renderSelectors() {
  const attendanceClass = $('attendanceClass');
  const previousClass = attendanceClass.value;
  const markStudent = $('markStudent');
  const previousStudent = markStudent.value;

  attendanceClass.replaceChildren();
  addOption(attendanceClass, '', 'All classes');

  const classNames = [...new Set(db.students.map((student) => student.className))]
    .sort((a, b) => a.localeCompare(b));

  for (const className of classNames) {
    addOption(attendanceClass, className, className);
  }

  if ([...attendanceClass.options].some((option) => option.value === previousClass)) {
    attendanceClass.value = previousClass;
  }

  markStudent.replaceChildren();

  for (const student of db.students) {
    addOption(markStudent, student.id, student.name + ' (' + student.roll + ')');
  }

  if ([...markStudent.options].some((option) => option.value === previousStudent)) {
    markStudent.value = previousStudent;
  }
}

function renderAttendance() {
  const date = $('date').value;
  const selectedClass = $('attendanceClass').value;
  const savedRecord = db.attendance[date] || {};
  const rows = $('attendanceRows');

  rows.replaceChildren();

  const visibleStudents = db.students.filter((student) => {
    return !selectedClass || student.className === selectedClass;
  });

  for (const student of visibleStudents) {
    const row = document.createElement('tr');
    row.dataset.id = student.id;
    row.append(makeCell(student.roll), makeCell(student.name));

    const statusCell = makeCell('');
    const statusSelect = document.createElement('select');

    [
      ['', 'Not marked'],
      ['Present', 'Present'],
      ['Absent', 'Absent']
    ].forEach(([value, label]) => addOption(statusSelect, value, label));

    statusSelect.value = savedRecord[student.id] || '';
    statusCell.append(statusSelect);
    row.append(statusCell);
    rows.append(row);
  }
}

function renderMarks() {
  const rows = $('markRows');
  rows.replaceChildren();

  for (const mark of db.marks) {
    const student = db.students.find((item) => item.id === mark.studentId);
    const row = document.createElement('tr');
    const percentage = (mark.obtained / mark.total) * 100;

    [
      student ? student.name : 'Deleted student',
      mark.subject,
      mark.obtained + ' / ' + mark.total,
      percentage.toFixed(1) + '%'
    ].forEach((value) => row.append(makeCell(value)));

    const actionCell = makeCell('');
    const deleteButton = document.createElement('button');

    deleteButton.className = 'danger';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      db.marks = db.marks.filter((item) => item.id !== mark.id);
      saveDatabase();
      renderMarks();
    });

    actionCell.append(deleteButton);
    row.append(actionCell);
    rows.append(row);
  }
}

$('add').addEventListener('submit', (event) => {
  event.preventDefault();

  const name = $('studentName').value.trim();
  const roll = $('roll').value.trim();
  const className = $('className').value.trim();

  if (!name || !roll || !className) return;

  const duplicate = db.students.some((student) => {
    return (
      student.roll.toLowerCase() === roll.toLowerCase() &&
      student.className.toLowerCase() === className.toLowerCase()
    );
  });

  if (duplicate) {
    alert('That roll number is already used in this class.');
    return;
  }

  db.students.push({
    id: crypto.randomUUID(),
    name,
    roll,
    className
  });

  saveDatabase();
  event.target.reset();
  render();
});

$('search').addEventListener('input', renderStudents);
$('attendanceClass').addEventListener('change', renderAttendance);
$('date').addEventListener('change', renderAttendance);

$('saveAttendance').addEventListener('click', () => {
  const date = $('date').value;

  if (!date) {
    alert('Choose a date first.');
    return;
  }

  const record = db.attendance[date] || {};

  for (const row of $('attendanceRows').children) {
    const studentId = row.dataset.id;
    const status = row.querySelector('select').value;

    if (status) {
      record[studentId] = status;
    } else {
      delete record[studentId];
    }
  }

  db.attendance[date] = record;
  saveDatabase();
  render();
  alert('Attendance saved.');
});

$('markForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const studentId = $('markStudent').value;
  const subject = $('subject').value.trim();
  const obtained = Number($('obtained').value);
  const total = Number($('total').value);

  const validInput =
    db.students.some((student) => student.id === studentId) &&
    subject &&
    Number.isFinite(obtained) &&
    Number.isFinite(total) &&
    total > 0 &&
    obtained >= 0 &&
    obtained <= total;

  if (!validInput) {
    alert('Check the student and marks values. Obtained marks cannot exceed total marks.');
    return;
  }

  const existingMark = db.marks.find((mark) => {
    return (
      mark.studentId === studentId &&
      mark.subject.toLowerCase() === subject.toLowerCase()
    );
  });

  if (existingMark) {
    existingMark.obtained = obtained;
    existingMark.total = total;
  } else {
    db.marks.push({
      id: crypto.randomUUID(),
      studentId,
      subject,
      obtained,
      total
    });
  }

  saveDatabase();
  event.target.reset();
  render();
});

function downloadFile(filename, contents, contentType) {
  const blob = new Blob([contents], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('export').addEventListener('click', () => {
  downloadFile(
    'classtrack-backup.json',
    JSON.stringify(db, null, 2),
    'application/json'
  );
});

$('csv').addEventListener('click', () => {
  const escapeCsv = (value) => {
    return '"' + String(value).replaceAll('"', '""') + '"';
  };

  const rows = [[
    'Name',
    'Roll',
    'Class',
    'Subject',
    'Obtained',
    'Total',
    'Percentage'
  ]];

  for (const mark of db.marks) {
    const student = db.students.find((item) => item.id === mark.studentId);
    if (!student) continue;

    rows.push([
      student.name,
      student.roll,
      student.className,
      mark.subject,
      mark.obtained,
      mark.total,
      ((mark.obtained / mark.total) * 100).toFixed(1)
    ]);
  }

  const csv = rows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');

  downloadFile('student-results.csv', csv, 'text/csv;charset=utf-8');
});

const tabButtons = document.querySelectorAll('[data-tab]');

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    for (const tab of tabButtons) {
      tab.classList.toggle('active', tab === button);
    }

    for (const panel of document.querySelectorAll('.panel')) {
      panel.classList.toggle('hidden', panel.id !== button.dataset.tab);
    }
  });
}

$('date').value = localDateValue();
render();
