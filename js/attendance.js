/*!
 * js/attendance.js
 * ---------------------------------------------------------------------------
 * "Mother's Lap School System" — daily attendance register
 * (pages/attendance.html).
 *
 * Attendance facts come from js/data.js: helpers.attendanceOf() derives a
 * stable status from a hash of (student id + date), so the demo register is
 * identical on every load and no 2,000 x 30 data matrix has to be stored.
 * Marks the user changes are kept in localStorage for the browser session
 * (key prefix "mls.attendance.").
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const Data = global.SchoolData;
  const App = global.App;
  const fmt = App.format;

  const STATUSES = ['Present', 'Absent', 'Leave', 'Late'];
  const STORAGE_KEY = 'attendance.';   // mls.attendance.<date>.<sectionId>

  const view = {
    className: 'Grade 5',
    sectionName: 'A',
    date: isoToday(),
    marks: {},        // studentId -> status (working copy)
    saved: {},        // studentId -> status (persisted)
    dirty: false
  };

  function isoToday() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
      + '-' + String(now.getDate()).padStart(2, '0');
  }

  /* ---- Persistence ------------------------------------------------------ */
  /**
   * Storage segment for the register. Uses the section's stable id (e.g. "G5-A")
   * rather than the display name so the key stays free of spaces and survives any
   * future renaming of a class label.
   */
  function sectionKey() {
    const section = Data.helpers.getSections(view.className).filter(function (item) {
      return item.sectionName === view.sectionName;
    })[0];
    return section ? section.id : view.className + '-' + view.sectionName;
  }

  function loadSaved() {
    const stored = App.storage.get(STORAGE_KEY + view.date + '.' + sectionKey(), {});
    view.saved = stored || {};
    view.marks = {};
    Object.keys(view.saved).forEach(function (id) { view.marks[id] = view.saved[id]; });
    view.dirty = false;
  }

  function saveMarks() {
    App.storage.set(STORAGE_KEY + view.date + '.' + sectionKey(), view.marks);
    view.saved = Object.assign({}, view.marks);
    view.dirty = false;
  }

  /* ---- Controls --------------------------------------------------------- */
  function renderControls() {
    const mount = App.qs('#register-controls');
    App.clear(mount);

    const classSelect = labelledSelect(
      'attendance-class', 'Class',
      Data.helpers.getClassOptions(),
      view.className,
      function (value) {
        view.className = value;
        view.sectionName = Data.helpers.getSections(value)[0].sectionName;
        loadSaved();
        renderAll();
      }
    );

    const sectionSelect = labelledSelect(
      'attendance-section', 'Section',
      Data.helpers.getSectionOptions(view.className),
      view.sectionName,
      function (value) {
        view.sectionName = value;
        loadSaved();
        renderAll();
      }
    );

    const dateInput = App.el('input', {
      class: 'input', type: 'date', id: 'attendance-date', value: view.date, max: isoToday()
    });
    dateInput.addEventListener('change', function (event) {
      view.date = event.target.value || isoToday();
      loadSaved();
      renderAll();
    });

    mount.appendChild(App.el('div', { class: 'field' }, [
      App.el('label', { class: 'field__label', for: classSelect.id, text: 'Class' }),
      classSelect
    ]));
    mount.appendChild(App.el('div', { class: 'field' }, [
      App.el('label', { class: 'field__label', for: sectionSelect.id, text: 'Section' }),
      sectionSelect
    ]));
    mount.appendChild(App.el('div', { class: 'field' }, [
      App.el('label', { class: 'field__label', for: dateInput.id, text: 'Date' }),
      dateInput
    ]));

    const classTeacher = Data.helpers.getClassTeacher(view.className, view.sectionName);
    App.qs('#class-teacher-badge').textContent = classTeacher
      ? 'Class teacher: ' + classTeacher.name
      : 'No class teacher assigned';
  }

  function labelledSelect(id, label, options, selected, onChange) {
    const select = App.el('select', { class: 'select', id: id },
      options.map(function (option) {
        return App.el('option', { value: option.value, text: option.label, selected: option.value === selected });
      }));
    select.addEventListener('change', function (event) { onChange(event.target.value); });
    return select;
  }

  /* ---- Summary ---------------------------------------------------------- */
  function renderSummary() {
    const mount = App.qs('#attendance-summary');
    const roster = currentRoster();
    const summary = tally();
    App.clear(mount);

    [
      {
        icon: 'check-circle', label: 'Present', value: fmt.number(summary.present),
        hint: fmt.percent(summary.total ? (summary.present / summary.total) * 100 : 0) + ' of the section',
        tone: 'success'
      },
      {
        icon: 'close', label: 'Absent', value: fmt.number(summary.absent),
        hint: 'Needs follow-up by the class teacher', tone: 'danger'
      },
      {
        icon: 'clock', label: 'On leave', value: fmt.number(summary.leave), hint: 'Approved absence', tone: 'warning'
      },
      {
        icon: 'alert', label: 'Late', value: fmt.number(summary.late), hint: 'Arrived after the bell', tone: 'warning'
      },
      {
        icon: 'clipboard', label: 'Attendance %', value: summary.percent.toFixed(1) + '%',
        hint: 'Present + late, of ' + roster.length + ' students',
        tone: summary.percent >= 90 ? 'success' : 'warning'
      },
      {
        icon: 'save', label: 'Register state',
        value: Object.keys(view.saved).length ? 'Saved' : 'Not saved',
        hint: view.dirty ? 'Unsaved changes in this browser' : 'Stored in this browser only',
        tone: view.dirty ? 'warning' : 'success'
      }
    ].forEach(function (card) { mount.appendChild(App.statCard(card)); });
  }

  /* ---- Register table ---------------------------------------------------- */
  function renderRegister() {
    const mount = App.qs('#register-table');
    const roster = currentRoster();
    const classTeacher = Data.helpers.getClassTeacher(view.className, view.sectionName);

    App.qs('#register-caption').textContent = view.className + ' - ' + view.sectionName
      + ' • ' + fmt.date(view.date, 'long') + ' • ' + roster.length + ' students'
      + (classTeacher ? ' • Class teacher: ' + classTeacher.name : '');

    const table = App.el('table', { class: 'table' }, [
      App.el('caption', { class: 'sr-only', text: 'Attendance register for ' + view.className + ' section ' + view.sectionName }),
      App.el('thead', {}, [
        App.el('tr', {}, [
          App.el('th', { scope: 'col', class: 'num', style: 'width:56px', text: 'Roll' }),
          App.el('th', { scope: 'col', text: 'Student' }),
          App.el('th', { scope: 'col', class: 'num', style: 'width:80px', text: 'Session %' }),
          App.el('th', { scope: 'col', style: 'width:280px', text: 'Mark' })
        ])
      ])
    ]);

    const body = App.el('tbody');
    roster.forEach(function (student) {
      const status = view.marks[student.id] || Data.helpers.attendanceOf(student, view.date);
      view.marks[student.id] = status;
      body.appendChild(App.el('tr', {}, [
        App.el('td', { class: 'num tabular', text: String(student.rollNo) }),
        App.el('td', {}, [
          App.el('div', { class: 'table__person' }, [
            App.el('span', {
              class: 'avatar avatar--sm avatar--' + (student.gender === 'Female' ? 'female' : 'male'),
              text: fmt.initials(student.name)
            }),
            App.el('span', {}, [
              App.el('span', { class: 'table__person-name', text: student.name }),
              App.el('br'),
              App.el('span', { class: 'table__person-meta', text: student.grNo })
            ])
          ])
        ]),
        App.el('td', { class: 'num' }, [
          App.badge(fmt.percent(student.attendance),
            'badge--' + (student.attendance >= 90 ? 'success' : (student.attendance >= 85 ? 'warning' : 'danger')))
        ]),
        App.el('td', {}, [statusPicker(student, status)])
      ]));
    });
    table.appendChild(body);

    App.clear(mount);
    mount.appendChild(table);

    const summary = tally();
    App.qs('#register-footer').textContent = 'Present ' + summary.present + ' • Absent ' + summary.absent
      + ' • Leave ' + summary.leave + ' • Late ' + summary.late
      + ' • Section attendance ' + summary.percent.toFixed(1) + '%';
  }

  /** Four-button group per student (accessible: aria-pressed + label). */
  function statusPicker(student, current) {
    const group = App.el('div', {
      class: 'chip-list', role: 'group',
      'aria-label': 'Attendance for ' + student.name
    });
    STATUSES.forEach(function (status) {
      const active = status === current;
      const button = App.el('button', {
        class: 'btn btn--sm ' + (active ? 'btn--primary' : 'btn--ghost'),
        type: 'button',
        'aria-pressed': active ? 'true' : 'false',
        text: status === 'Present' ? 'P' : (status === 'Absent' ? 'A' : (status === 'Leave' ? 'L' : 'T')),
        title: status
      });
      button.addEventListener('click', function () {
        view.marks[student.id] = status;
        view.dirty = true;
        renderRegister();
        renderSummary();
      });
      group.appendChild(button);
    });
    return group;
  }

  /* ---- Month to date ------------------------------------------------------ */
  function renderMonth() {
    const mount = App.qs('#month-table');
    const matrix = Data.helpers.getSectionAttendanceMatrix(view.className, view.sectionName, 22);
    App.qs('#month-caption').textContent = matrix.dates.length
      + ' school days recorded • ' + matrix.className + ' - ' + matrix.sectionName;

    const table = App.el('table', { class: 'table table--compact' }, [
      App.el('caption', { class: 'sr-only', text: 'Month-to-date attendance' }),
      App.el('thead', {}, [
        App.el('tr', {}, [
          App.el('th', { scope: 'col', text: 'Student' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Present' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Absent' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Leave' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Month %' })
        ])
      ])
    ]);

    const body = App.el('tbody');
    matrix.matrix.forEach(function (row) {
      const summary = row.summary;
      body.appendChild(App.el('tr', {}, [
        App.el('th', { scope: 'row' }, [
          App.el('span', { class: 'table__person-name', text: row.student.name }),
          App.el('br'),
          App.el('span', { class: 'table__person-meta', text: 'Roll ' + row.student.rollNo })
        ]),
        App.el('td', { class: 'num tabular', text: String(summary.present + summary.late) }),
        App.el('td', { class: 'num tabular', text: String(summary.absent) }),
        App.el('td', { class: 'num tabular', text: String(summary.leave) }),
        App.el('td', { class: 'num' }, [
          App.badge(fmt.percent(summary.percent),
            'badge--' + (summary.percent >= 90 ? 'success' : (summary.percent >= 80 ? 'warning' : 'danger')))
        ])
      ]));
    });
    table.appendChild(body);

    App.clear(mount);
    mount.appendChild(table);
  }

  /* ---- Helpers ------------------------------------------------------------ */
  function currentRoster() {
    return Data.getStudentsByClass(view.className, view.sectionName);
  }

  function tally() {
    const summary = { present: 0, absent: 0, leave: 0, late: 0, total: currentRoster().length };
    Object.keys(view.marks).forEach(function (id) {
      const key = view.marks[id].toLowerCase();
      if (summary[key] !== undefined) summary[key]++;
    });
    summary.percent = summary.total
      ? Math.round(((summary.present + summary.late) / summary.total) * 1000) / 10
      : 0;
    return summary;
  }

  function renderAll() {
    renderControls();
    renderSummary();
    renderRegister();
    renderMonth();
  }

  /* ---- Actions ------------------------------------------------------------ */
  function wireActions() {
    App.qs('#btn-all-present').addEventListener('click', function () {
      currentRoster().forEach(function (student) { view.marks[student.id] = 'Present'; });
      view.dirty = true;
      renderRegister();
      renderSummary();
      App.toast('All ' + currentRoster().length + ' students marked present', 'success');
    });

    App.qs('#btn-save').addEventListener('click', function () {
      saveMarks();
      renderSummary();
      renderRegister();
      App.toast('Register saved for ' + view.className + ' - ' + view.sectionName
        + ' on ' + fmt.date(view.date, 'medium') + ' (stored in this browser only)', 'success');
    });

    App.qs('#btn-print').addEventListener('click', function () { global.print(); });
  }

  /* ---- Init --------------------------------------------------------------- */
  document.addEventListener('app:ready', function () {
    /* Deep link: pages/attendance.html?class=Grade+5&section=B */
    const requestedClass = App.queryParam('class');
    const requestedSection = App.queryParam('section');
    if (requestedClass && Data.helpers.getClass(requestedClass)) view.className = requestedClass;
    if (requestedSection && Data.helpers.getSections(view.className)
      .some(function (section) { return section.sectionName === requestedSection; })) {
      view.sectionName = requestedSection;
    }

    loadSaved();
    renderAll();
    wireActions();
  });

}(window));