/*!
 * js/students.js
 * ---------------------------------------------------------------------------
 * "Mother's Lap School System" — student register (pages/students.html).
 *
 * Uses App.createDataTable() so the 2,000 demo records are never all in the
 * DOM: the toolbar provides a debounced search (name / GR number / guardian /
 * phone), four filters, sortable columns and pagination.
 *
 * All data comes from window.SchoolData (js/data.js).
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const Data = global.SchoolData;
  const App = global.App;
  const helpers = Data.helpers;
  const fmt = App.format;

  /* Rows per page offered by the page-size selector. 20 is the default. */
  const PAGE_SIZES = [10, 20, 50];

  /* What the search box matches. Guardian and phone are here as well as name
     and GR number because a school office looks a student up by whichever the
     parent happens to have on file. */
  const SEARCH_KEYS = ['name', 'grNo', 'guardian', 'phone'];

  /* Class sort order is the school's own order (Playgroup -> Grade 10), not
     alphabetical — otherwise "Grade 10" sorts before "Grade 2". */
  const CLASS_ORDER = {};
  Data.classes.forEach(function (klass) { CLASS_ORDER[klass.name] = klass.order; });

  let table = null;

  /* ---- Summary cards --------------------------------------------------- */
  function renderSummary() {
    const mount = App.qs('#students-summary');
    const students = Data.students;

    const active = students.filter(function (student) { return student.status === 'Active'; }).length;
    const averageAttendance = students.reduce(function (sum, student) {
      return sum + student.attendance;
    }, 0) / students.length;
    const feePending = students.filter(function (student) {
      return student.feeStatus === 'Pending' || student.feeStatus === 'Overdue' || student.feeStatus === 'Partial';
    }).length;
    const girls = students.filter(function (student) { return student.gender === 'Female'; }).length;

    App.clear(mount);
    [
      { icon: 'users', label: 'Total students', value: fmt.number(students.length), hint: '13 classes • 52 sections' },
      { icon: 'check-circle', label: 'Active', value: fmt.number(active), hint: (students.length - active) + ' on leave / inactive / left', tone: 'success' },
      { icon: 'clipboard', label: 'Avg attendance', value: fmt.percent(averageAttendance), hint: 'Whole school, session average', tone: 'info' },
      { icon: 'wallet', label: 'Fees outstanding', value: fmt.number(feePending), hint: 'Students with a pending balance', tone: 'warning' },
      { icon: 'user', label: 'Girls', value: fmt.number(girls), hint: Math.round(girls / students.length * 100) + '% of the register', tone: 'purple' }
    ].forEach(function (card) { mount.appendChild(App.statCard(card)); });
  }

  /* ---- Student profile panel -------------------------------------------- */
  /**
   * Opens the student record in the right-hand side panel.
   *
   * A panel rather than a centred modal, because the register behind it stays
   * visible: staff routinely compare the record they are reading against the
   * rest of the section. `trigger` is the row or button that opened it, so
   * focus returns there on close.
   */
  function openProfile(student, trigger) {
    const section = helpers.getSection(student.sectionId);
    const classTeacher = helpers.getClassTeacher(student.className, student.sectionName);
    const fee = helpers.getFeeStructure(student.className);
    const roster = helpers.getStudentsByClass(student.className, student.sectionName);
    /* Where this student's attendance sits in their own section — a percentage
       alone says nothing about whether it is normal for the class. */
    const sectionAttendance = roster
      .map(function (mate) { return mate.attendance; })
      .sort(function (a, b) { return b - a; });
    /* `indexOf` finds the *first* student holding this value, so a shared
       attendance figure reports the best of the tied positions rather than an
       arbitrary one. Counting ahead of the match would be wrong instead: the
       sort is descending, so equal values sit adjacent and the true rank is
       "how many are strictly higher, plus one". */
    const higher = sectionAttendance.filter(function (value) {
      return value > student.attendance;
    }).length;
    const rank = higher + 1;
    const sectionAverage = sectionAttendance.length
      ? sectionAttendance.reduce(function (sum, value) { return sum + value; }, 0) / sectionAttendance.length
      : 0;

    const body = App.el('div', { class: 'stack' }, [
      App.el('div', { class: 'flex gap-2' }, [
        App.el('span', {
          class: 'avatar avatar--lg avatar--' + (student.gender === 'Female' ? 'female' : 'male'),
          'aria-hidden': 'true',
          text: fmt.initials(student.name)
        }),
        App.el('div', { style: 'min-width:0' }, [
          App.el('h3', { class: 'mb-0', text: student.name }),
          App.el('p', {
            class: 'text-sm text-muted mb-0',
            text: student.grNo + ' • ' + student.className + ' - ' + student.sectionName
              + ' • Roll ' + student.rollNo
          }),
          App.el('div', { class: 'chip-list mt-1' }, [
            App.badge(student.status),
            App.badge(student.feeStatus),
            App.badge(student.gender)
          ])
        ])
      ]),

      /* --- personal --- */
      App.el('h4', { class: 'mt-1 mb-0', text: 'Personal information' }),
      App.metaList([
        ['Date of birth', fmt.date(student.dateOfBirth, 'long') + ' (' + student.age + ' years)'],
        ['Gender', student.gender],
        ['Blood group', student.bloodGroup],
        ['Admission date', fmt.date(student.admissionDate, 'long')],
        ['Transport', student.transport === 'Yes' ? 'Uses school transport' : 'Own arrangement'],
        ['Address', student.address],
        ['Class teacher', classTeacher ? classTeacher.name : '—'],
        ['Section strength', section ? section.students + ' students (' + section.boys + ' boys, ' + section.girls + ' girls)' : '—']
      ]),

      /* --- guardian --- */
      App.el('h4', { class: 'mt-1 mb-0', text: 'Guardian information' }),
      App.metaList([
        ['Guardian', student.guardian],
        ['Relation', student.guardianRelation],
        ['Phone', student.phone],
        ['Address', student.address]
      ]),

      /* --- attendance --- */
      App.el('h4', { class: 'mt-1 mb-0', text: 'Attendance summary' }),
      App.meter({
        label: 'Attendance',
        percent: student.attendance,
        text: fmt.percent(student.attendance),
        tone: attendanceTone(student.attendance)
      }),
      App.el('p', { class: 'text-xs text-muted mt-1', text:
        fmt.percent(student.attendance) + ' this session • '
        + rank + ' of ' + sectionAttendance.length + ' in ' + student.className
        + ' - ' + student.sectionName + ' • section average '
        + fmt.percent(sectionAverage)
      }),

      /* --- fees --- */
      App.el('h4', { class: 'mt-1 mb-0', text: 'Fee status' }),
      App.metaList([
        ['Monthly tuition', fee ? fmt.currency(fee.monthlyTuition) : '—'],
        ['Expected', fmt.currency(student.feeExpected)],
        ['Paid', fmt.currency(student.feePaid)],
        ['Balance', student.feeBalance > 0
          ? fmt.currency(student.feeBalance) + ' outstanding'
          : 'Cleared — nothing outstanding']
      ]),
      App.meter({
        label: 'Fees paid',
        percent: student.feeExpected ? (student.feePaid / student.feeExpected) * 100 : 0,
        text: fmt.currency(student.feePaid) + ' of ' + fmt.currency(student.feeExpected),
        tone: student.feeBalance === 0 ? 'success' : 'warning'
      }),
      fee ? App.el('p', {
        class: 'text-xs text-muted mt-1',
        text: 'Fee structure: tuition ' + fmt.currency(fee.monthlyTuition) + ' + library '
          + fmt.currency(fee.libraryFee) + ' + lab ' + fmt.currency(fee.labFee)
          + ' + transport ' + fmt.currency(fee.transportFee) + ' per month.'
      }) : null,

      App.el('h4', { class: 'mt-1', text: 'Subjects this session (' + student.className + ')' }),
      App.el('div', { class: 'chip-list' }, helpers.getClassSubjects(student.className).map(function (subject) {
        return App.el('span', { class: 'chip', text: subject });
      }))
    ]);

    App.panel({
      title: student.name,
      content: body,
      actions: [
        { label: 'Close', variant: 'ghost', onClick: App.closePanel },
        {
          label: 'Delete',
          variant: 'danger-quiet',
          onClick: function () {
            /* Raised from here, so the panel has to come down with the
               confirmation — or the reader is left looking at a record they
               have just deleted. */
            confirmDelete(student, null);
          }
        },
        {
          label: 'Edit details',
          variant: 'primary',
          onClick: function () {
            openStudentForm(student, App.qs('#app-panel-footer .btn--primary'));
          }
        }
      ]
    });

    /* Remember what opened the panel so focus can go back to it. */
    if (trigger) App.qs('#app-panel')._returnFocus = trigger;
  }

  /** Tone for an attendance percentage — shared by the cell and the panel. */
  function attendanceTone(percent) {
    return percent >= 90 ? 'success' : (percent >= 85 ? 'warning' : 'danger');
  }

  /* ---- Record writes ---------------------------------------------------- */
  /* One form for both directions. `editing` null means add; otherwise the form
   * opens pre-filled and the save becomes an update. Sharing the markup means
   * the two can never drift apart, and the validators below run identically
   * either way. */
  const RELATIONS = ['Father', 'Mother', 'Guardian', 'Uncle', 'Aunt'];
  const STATUSES = ['Active', 'On Leave', 'Inactive', 'Left'];
  const FEE_STATUSES = ['Paid', 'Pending', 'Partial', 'Overdue'];

  function findSection(className, sectionName) {
    return helpers.getSections(className).filter(function (section) {
      return section.sectionName === sectionName;
    })[0] || null;
  }

  function firstClass() {
    return Data.classes[0].name;
  }

  /**
   * Roll number, scoped to the class and section currently selected in the
   * form. This is the one rule that cannot live on the field alone: the same
   * number is free in Grade 4 A and taken in Grade 5 A, so the verdict depends
   * on two sibling controls. `allValues` is what makes that expressible.
   */
  function rollNumberRule(excludingId) {
    return App.validators.custom(function (value, bag) {
      if (!String(value).trim()) return '';
      const number = Number(value);
      if (Number.isNaN(number)) return 'Roll number must be a number';
      const section = findSection(bag.className, bag.sectionName);
      if (!section) return 'Choose a class and section first';
      if (helpers.isRollNoTaken(section.className, section.sectionName, number, excludingId)) {
        return 'Roll number ' + number + ' is already used in ' + section.label;
      }
      return '';
    });
  }

  /** Opens the Add / Edit dialog. `editing` is the record, or null to add. */
  function openStudentForm(editing, trigger) {
    const startClass = editing ? editing.className : firstClass();
    const startSection = editing
      ? editing.sectionName
      : helpers.getSections(startClass)[0].sectionName;

    const form = App.formModal({
      title: editing ? 'Edit ' + editing.name : 'Add student',
      submitLabel: editing ? 'Save changes' : 'Add student',
      gridClass: 'form-grid',
      fields: [
        {
          name: 'name', label: 'Student name', required: true, full: true,
          value: editing ? editing.name : '',
          placeholder: 'e.g. Zainab Khan',
          hint: 'Letters only. Spaces, hyphens and apostrophes are fine.',
          autocomplete: 'off',
          rules: App.validators.compose(
            App.validators.required('Student name'),
            App.validators.lettersOnly('Student name'),
            App.validators.minLength(3)
          )
        },
        {
          name: 'gender', label: 'Gender', required: true,
          type: 'select',
          options: [{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }],
          value: editing ? editing.gender : 'Female'
        },
        {
          name: 'className', label: 'Class', required: true, type: 'select',
          options: helpers.getClassOptions().map(function (option) {
            return { value: option.value, label: option.label };
          }),
          value: startClass
        },
        {
          /* Depends on the class, so it re-fills whenever that changes. */
          name: 'sectionName', label: 'Section', required: true, type: 'select',
          dynamic: true,
          options: function (bag) {
            return helpers.getSectionOptions(bag.className || firstClass())
              .map(function (option) {
                return { value: option.value, label: option.label };
              });
          },
          value: startSection
        },
        {
          name: 'rollNo', label: 'Roll number', required: true,
          value: editing ? editing.rollNo : '',
          placeholder: 'e.g. 12',
          inputmode: 'numeric', maxlength: 3,
          hint: 'Unique within the class and section.',
          rules: App.validators.compose(
            App.validators.required('Roll number'),
            App.validators.digitsOnly('Roll number'),
            App.validators.range(1, 200),
            rollNumberRule(editing ? editing.id : null)
          )
        },
        {
          name: 'guardian', label: 'Guardian name', required: true,
          value: editing ? editing.guardian : '',
          placeholder: 'e.g. Imran Khan',
          hint: 'Letters only.',
          rules: App.validators.compose(
            App.validators.required('Guardian name'),
            App.validators.lettersOnly('Guardian name'),
            App.validators.minLength(3)
          )
        },
        {
          name: 'guardianRelation', label: 'Relation', required: true, type: 'select',
          options: RELATIONS.map(function (value) { return { value: value, label: value }; }),
          value: editing ? editing.guardianRelation : 'Father'
        },
        {
          name: 'phone', label: 'Phone', required: true,
          value: editing ? editing.phone : '',
          placeholder: '0300-1234567',
          inputmode: 'tel', maxlength: 13,
          hint: 'Format 03XX-XXXXXXX.',
          rules: App.validators.compose(
            App.validators.required('Phone'),
            App.validators.phone('Phone')
          )
        },
        {
          name: 'address', label: 'Home address', full: true,
          value: editing ? editing.address : '',
          placeholder: 'Optional'
        },
        {
          name: 'status', label: 'Status', type: 'select',
          options: STATUSES.map(function (value) { return { value: value, label: value }; }),
          value: editing ? editing.status : 'Active'
        },
        {
          name: 'feeStatus', label: 'Fee status', type: 'select',
          options: FEE_STATUSES.map(function (value) { return { value: value, label: value }; }),
          value: editing ? editing.feeStatus : 'Pending'
        }
      ],

      onSubmit: function (values) {
        const payload = {
          name: values.name,
          gender: values.gender,
          className: values.className,
          sectionName: values.sectionName,
          rollNo: Number(values.rollNo),
          guardian: values.guardian,
          guardianRelation: values.guardianRelation,
          phone: values.phone,
          address: values.address,
          status: values.status,
          feeStatus: values.feeStatus
        };

        /* announce() reads table.state.view, so the register has to be re-rendered
           before it — that is what makes "no page reload" true rather than
           merely a toast that lies. */
        if (editing) {
          helpers.updateStudent(editing.id, payload);
          refreshRegister();
          announce('Updated', helpers.getStudentById(editing.id));
        } else {
          const created = helpers.addStudent(payload);
          refreshRegister();
          announce('Added', created);
        }
      }
    });

    /* Focus returns to the button that opened the form, unless the table
       re-renders it away first — closeModal then falls back to the landmark. */
    if (trigger) form.modal._returnFocus = trigger;
  }

  /** Toast for a successful write, honest about whether the row is on screen. */
  function announce(action, student) {
    const where = student.className + ' - ' + student.sectionName;
    const onScreen = table && table.state.view.indexOf(student) !== -1;
    App.toast(
      action + ' ' + student.name + ' • ' + where + ' • roll ' + student.rollNo
      + (onScreen ? '' : ' — saved, but not shown: it does not match the active filters'),
      'success'
    );
  }

  /** Confirmation before a delete, naming the record as the brief requires. */
  function confirmDelete(student, trigger) {
    const modal = App.confirm({
      title: 'Delete this student?',
      message: 'Delete ' + student.name + ' (' + student.grNo + ') from '
        + student.className + ' - ' + student.sectionName + '?',
      note: 'The record leaves the register and the section roll. This prototype keeps '
        + 'nothing in a database, so a page reload brings the record back.',
      confirmLabel: 'Delete ' + student.firstName,
      variant: 'danger',
      onConfirm: function () {
        helpers.removeStudent(student.id);
        App.closePanel();
        refreshRegister();
        App.toast('Deleted ' + student.name + ' (' + student.grNo + ')', 'success');
      }
    });
    if (trigger) modal._returnFocus = trigger;
  }

  /**
   * Re-reads everything the page shows from the data layer and re-renders.
   * `table.refresh(rows)` re-runs the *existing* filter and search, so an added
   * record only appears if it matches what the reader is already looking at —
   * which is what "stays consistent with the active filters" has to mean.
   */
  function refreshRegister() {
    renderSummary();
    if (table) table.refresh(Data.students);
  }

  /* ---- Columns --------------------------------------------------------- */
  function buildColumns() {
    return [
      {
        /* Avatar initials + name in one cell: the initials are a visual
           anchor for scanning a long column, not information in their own
           right, so they get no separate column. */
        key: 'name',
        label: 'Student',
        sortValue: function (row) { return row.name; },
        render: function (row) {
          return App.el('div', { class: 'table__person' }, [
            App.el('span', {
              class: 'avatar avatar--sm avatar--' + (row.gender === 'Female' ? 'female' : 'male'),
              'aria-hidden': 'true',
              text: fmt.initials(row.name)
            }),
            App.el('span', { style: 'min-width:0' }, [
              App.el('span', { class: 'table__person-name', text: row.name }),
              App.el('br'),
              App.el('span', { class: 'table__person-meta', text: row.gender + ' • ' + row.age + ' yrs' })
            ])
          ]);
        }
      },
      {
        key: 'grNo',
        label: 'GR no',
        width: '128px',
        render: function (row) {
          return App.el('span', { class: 'tabular font-semibold text-primary', text: row.grNo });
        }
      },
      {
        key: 'className',
        label: 'Class',
        width: '104px',
        sortValue: function (row) {
          return CLASS_ORDER[row.className] || 99;
        },
        render: function (row) {
          return App.el('span', { class: 'font-semibold', text: row.className });
        }
      },
      {
        key: 'sectionName',
        label: 'Section',
        width: '84px',
        render: function (row) {
          return App.el('span', { text: row.sectionName });
        }
      },
      {
        key: 'rollNo',
        label: 'Roll no',
        width: '78px',
        /* Numeric, so "10" follows "9" instead of sorting between 1 and 2. */
        sortValue: function (row) { return Number(row.rollNo) || 0; },
        render: function (row) {
          return App.el('span', { class: 'tabular num', text: String(row.rollNo) });
        }
      },
      {
        key: 'guardian',
        label: 'Guardian / contact',
        render: function (row) {
          return App.el('span', {}, [
            App.el('span', { text: row.guardian }),
            App.el('br'),
            App.el('span', { class: 'table__person-meta', text: row.guardianRelation + ' • ' + row.phone })
          ]);
        }
      },
      {
        key: 'attendance',
        label: 'Attendance',
        width: '124px',
        sortValue: function (row) { return Number(row.attendance) || 0; },
        render: function (row) {
          /* A bare percentage makes 89.4% and 89.6% hard to compare at a
             glance; a bar makes the gap obvious and the number stays exact. */
          return App.el('div', { class: 'cell-bar' }, [
            App.el('span', {
              class: 'progress progress--mini',
              'aria-hidden': 'true'
            }, [
              App.el('span', {
                class: 'progress__bar progress__bar--' + attendanceTone(row.attendance),
                style: 'width:' + row.attendance + '%'
              })
            ]),
            App.el('span', {
              class: 'cell-bar__value tabular',
              text: fmt.percent(row.attendance)
            })
          ]);
        }
      },
      {
        key: 'feeStatus',
        label: 'Fee status',
        width: '140px',
        sortValue: function (row) { return row.feeBalance; },
        render: function (row) {
          return App.el('span', {}, [
            App.badge(row.feeStatus),
            App.el('br'),
            App.el('span', {
              class: 'table__person-meta tabular',
              text: row.feeBalance > 0 ? fmt.currency(row.feeBalance) + ' due' : 'Cleared'
            })
          ]);
        }
      },
      {
        key: 'status',
        label: 'Status',
        width: '104px',
        render: function (row) { return App.badge(row.status); }
      },
      {
        /* Not a record field, so not sortable and not exported. */
        key: '_actions',
        label: 'Actions',
        width: '148px',
        sortable: false,
        exportValue: function () { return ''; },
        render: function (row) {
          /* Every control stops propagation. The row is already clickable, so a
             button that let the event bubble would fire the row handler as
             well — opening the profile behind the edit form, or the delete
             prompt behind the panel it was raised from. */
          function action(options) {
            const button = App.el('button', {
              class: 'btn ' + options.className,
              type: 'button',
              html: App.icon(options.icon, 'icon--sm') + (options.text ? '<span>' + options.text + '</span>' : ''),
              title: options.text ? '' : options.label,
              'aria-label': options.label + ' ' + row.name
            });
            button.addEventListener('click', function (event) {
              event.stopPropagation();
              options.run(button);
            });
            return button;
          }

          return App.el('div', { class: 'row-actions' }, [
            action({
              className: 'btn--ghost btn--sm',
              icon: 'eye', text: 'Profile', label: 'Open the profile of',
              run: function (button) { openProfile(row, button); }
            }),
            action({
              className: 'btn--icon btn--icon-xs btn--secondary',
              icon: 'edit', label: 'Edit',
              run: function (button) { openStudentForm(row, button); }
            }),
            action({
              className: 'btn--icon btn--icon-xs btn--danger-quiet',
              icon: 'trash', label: 'Delete',
              run: function (button) { confirmDelete(row, button); }
            })
          ]);
        }
      }
    ];
  }

  /* ---- Filters --------------------------------------------------------- */
  function buildFilters() {
    /* Class and section option lists are functions, not fixed arrays: they
       carry head-counts, and an add or a delete changes those. createDataTable
       re-evaluates an options function on every refresh, so the numbers next
       to each class stay true after a write without rebuilding the toolbar. */
    return [
      {
        key: 'className', label: 'Class', allLabel: 'All classes',
        options: function () {
          const summary = helpers.getClassSummary();
          return helpers.getClassOptions().map(function (option) {
            const row = summary.filter(function (item) {
              return item.className === option.value;
            })[0];
            return { value: option.value, label: option.value, count: row ? row.totalStudents : 0 };
          });
        }
      },
      {
        key: 'sectionName', label: 'Section', allLabel: 'All sections',
        /* Sections depend on the selected class. */
        options: function () {
          const selectedClass = table ? table.state.filterValues.className : '';
          const sections = Data.helpers.getSections(selectedClass || undefined);
          return sections.map(function (section) {
            return { value: section.sectionName, label: section.label, count: section.students };
          });
        }
      },
      {
        key: 'gender', label: 'Gender', allLabel: 'All',
        options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]
      },
      {
        key: 'status', label: 'Status', allLabel: 'Any status',
        options: ['Active', 'On Leave', 'Inactive', 'Left'].map(function (value) {
          return { value: value, label: value };
        })
      },
      {
        key: 'feeStatus', label: 'Fee status', allLabel: 'Any',
        options: ['Paid', 'Pending', 'Partial', 'Overdue'].map(function (value) {
          return { value: value, label: value };
        })
      }
    ];
  }

  /* ---- Page buttons ---------------------------------------------------- */
  function wireButtons() {
    const reset = App.qs('#btn-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        if (!table) return;
        ['className', 'sectionName', 'gender', 'status', 'feeStatus'].forEach(function (key) {
          table.setFilter(key, '');
        });
        const search = App.qs('#students-search');
        if (search) search.value = '';
        table.state.query = '';
        table.state.page = 1;
        table.refresh();
        App.toast('Filters cleared', 'success');
      });
    }

    const add = App.qs('#btn-add-student');
    if (add) {
      add.addEventListener('click', function () { openStudentForm(null, add); });
    }
  }

  /* ---- Init ------------------------------------------------------------ */
  document.addEventListener('app:ready', function () {
    renderSummary();

    table = App.createDataTable({
      mount: '#students-table',
      id: 'students',
      rows: Data.students,
      rowKey: 'id',
      columns: buildColumns(),
      filters: buildFilters(),
      /* The register is a working list, not an archive: 20 rows is a screenful
         that fits without the header leaving the viewport, and the page-size
         selector offers 10 for a phone and 50 for a wide desktop. */
      pageSize: 20,
      pageSizes: PAGE_SIZES,
      searchKeys: SEARCH_KEYS,
      searchPlaceholder: 'Search name, GR number, guardian or phone…',
      searchLabel: 'Search students',
      initialSort: { key: 'name', dir: 'asc' },
      onRowClick: openProfile,
      exportName: 'mothers-lap-students',
      caption: 'Student register with GR number, class, roll number, guardian, attendance and fee status',
      emptyTitle: 'No students match your filters'
    });

    /* Deep link support: pages/students.html?class=Grade+5
                       pages/students.html?search=Ali  (from the topbar search) */
    const requestedClass = App.queryParam('class');
    if (requestedClass) table.setFilter('className', requestedClass);
    const requestedSearch = App.queryParam('search');
    if (requestedSearch) table.setSearch(requestedSearch);

    wireButtons();
  });

}(window));