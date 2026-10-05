/*!
 * js/dashboard.js
 * ---------------------------------------------------------------------------
 * "Mother's Lap School System" — dashboard page (index.html).
 *
 * Everything on this page is derived from window.SchoolData (js/data.js).
 * There is not one typed-in figure on the dashboard: the aggregates come from
 * the helpers (`getClassSummary`, `getFeeSummary`, `getMonthlyFeeSummary`,
 * `getAttendanceTrend`, `getGenderSummary`, `getExamPapers`,
 * `getRecentActivity`), so the same numbers appear here, on their own module
 * page and in the console self-check.
 *
 * What it renders:
 *   - welcome banner (brand name, session facts)
 *   - six KPI cards, the numeric ones counting up
 *   - students per class (CSS bar chart) + gender split (conic-gradient donut)
 *   - attendance for the last 7 school days (inline SVG line chart)
 *   - fee overview for the current month (donut + weakest classes)
 *   - recent activities (timeline), latest announcements, upcoming exams
 *
 * Only aggregates and short samples become DOM nodes. The student register is
 * never rendered here, and the 360-row exam paper schedule is built lazily, the
 * first time someone opens the disclosure that contains it.
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const Data = global.SchoolData;
  const App = global.App;
  const fmt = App.format;
  const helpers = Data.helpers;

  /* How many rows the "upcoming exams" card shows before the disclosure. */
  const EXAM_PREVIEW_COUNT = 7;
  const ANNOUNCEMENT_COUNT = 5;
  const ACTIVITY_COUNT = 8;
  const TREND_DAYS = 7;

  /* Segment colours. Design tokens only — the conic-gradient is assembled from
     these strings, so a literal here would put a colour outside the token
     layer that css/audit keeps honest. */
  const COLOURS = {
    male: 'var(--blue-500)',
    female: 'var(--color-rose)',
    paid: 'var(--color-success)',
    pending: 'var(--color-warning)'
  };

  /* Activity kind -> icon name and badge tone. The data layer supplies only
     the kind, because a data layer should not know how a thing is drawn. */
  const ACTIVITY_STYLE = {
    admission: { icon: 'user-plus', tone: 'info' },
    announcement: { icon: 'megaphone', tone: 'purple' },
    exam: { icon: 'award', tone: 'success' },
    assignment: { icon: 'book', tone: 'info' },
    attendance: { icon: 'clipboard', tone: 'success' },
    fees: { icon: 'wallet', tone: 'warning' }
  };

  /* ======================================================================
   * WELCOME BANNER
   * The <h1> lives in index.html so the brand name is in the markup; this
   * fills in the session facts around it.
   * ==================================================================== */
  function renderBanner() {
    const attendance = helpers.getAttendanceToday();
    const session = Data.session;

    App.qs('#banner-mark').innerHTML = App.icon('school');

    const hours = new Date().getHours();
    const partOfDay = hours < 12 ? 'Good morning' : (hours < 17 ? 'Good afternoon' : 'Good evening');
    App.qs('#banner-eyebrow').textContent = partOfDay + ', ' + Data.school.principal;

    App.qs('#banner-lead').textContent = Data.school.name + ' — ' + Data.school.addressShort + '. '
      + Data.school.level + ', ' + Data.school.medium + ' medium, ' + Data.school.timings + '. '
      + 'Every figure below is the session ' + session.label + ' picture.';

    const facts = [
      ['Students', fmt.number(Data.totals.students)],
      ['Teachers', fmt.number(Data.totals.teachers)],
      ['Sections', fmt.number(Data.totals.sections)],
      ['Attendance today', attendance.percent.toFixed(1) + '%'],
      ['Session', session.label]
    ];
    App.renderFacts('#banner-facts', facts.map(function (fact) {
      return { label: fact[0], value: fact[1] };
    }));
  }

  /* ======================================================================
   * KPI CARDS (counting up)
   *
   * `value` is the true figure and is what a card shows with JavaScript off,
   * under reduced motion, or in print; `count` is what animates from zero to
   * the same figure.
   * ==================================================================== */
  function renderKpis() {
    const mount = App.qs('#kpi-grid');
    const attendance = helpers.getAttendanceToday();
    const fees = helpers.getMonthlyFeeSummary();

    const cards = [
      {
        icon: 'users',
        label: 'Total students',
        value: fmt.number(Data.totals.students),
        count: { to: Data.totals.students, format: fmt.number },
        hint: Data.totals.classes + ' classes • ' + Data.totals.sections + ' sections'
      },
      {
        icon: 'user-check',
        label: 'Total teachers',
        value: fmt.number(Data.totals.teachers),
        count: { to: Data.totals.teachers, format: fmt.number },
        hint: 'Teaching ' + Data.totals.subjects + ' subjects'
      },
      {
        icon: 'school',
        label: 'Total classes',
        value: fmt.number(Data.totals.classes),
        count: { to: Data.totals.classes, format: fmt.number },
        hint: Data.school.level + ' • ' + Data.totals.sections + ' sections'
      },
      {
        icon: 'clipboard',
        label: "Today's attendance",
        value: attendance.percent.toFixed(1) + '%',
        count: {
          to: attendance.percent,
          format: function (value) { return value.toFixed(1) + '%'; }
        },
        hint: fmt.number(attendance.present + attendance.late) + ' of ' + fmt.number(attendance.total)
          + ' present or late',
        tone: attendance.percent >= 90 ? 'success' : 'warning'
      },
      {
        icon: 'wallet',
        label: 'Fees collected, ' + fees.monthName,
        value: fmt.currency(fees.collected),
        count: { to: fees.collected, format: fmt.currency },
        hint: fees.percent.toFixed(1) + '% of the ' + fees.monthName + ' bill',
        tone: fees.percent >= 85 ? 'success' : 'warning'
      },
      {
        icon: 'alert',
        label: 'Pending fees, ' + fees.monthName,
        value: fmt.currency(fees.pending),
        count: { to: fees.pending, format: fmt.currency },
        hint: fmt.number(fees.byStatus.Overdue) + ' overdue • ' + fees.monthName + ' bill ' + fmt.currency(fees.billed),
        tone: 'danger'
      }
    ];

    App.clear(mount);
    cards.forEach(function (card) { mount.appendChild(App.statCard(card)); });
    App.runCountUps();
  }

  /* ======================================================================
   * STUDENTS PER CLASS — CSS bar chart
   * ==================================================================== */
  function renderStrength() {
    const mount = App.qs('#strength-chart');
    const summary = Data.getClassSummary();
    const strongest = summary.reduce(function (best, row) {
      return !best || row.totalStudents > best.totalStudents ? row : best;
    }, null);

    App.qs('#strength-caption').textContent = fmt.number(Data.totals.students) + ' students across '
      + Data.totals.classes + ' classes and ' + Data.totals.sections + ' sections'
      + (strongest ? ' • largest is ' + strongest.className : '');

    App.clear(mount);
    mount.appendChild(App.barChart(
      summary.map(function (row) {
        return { label: row.className, short: row.code, value: row.totalStudents };
      }),
      { label: 'Students per class', format: function (value) { return value + ' students'; } }
    ));

    /* Text alternative for the chart, and the per-class fee detail. */
    const table = App.el('table', { class: 'table table--compact mt-1' }, [
      App.el('caption', { class: 'sr-only', text: 'Students, class teacher and monthly fee per class' }),
      App.el('thead', {}, [
        App.el('tr', {}, [
          App.el('th', { scope: 'col', text: 'Class' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Sections' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Students' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Boys' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Girls' }),
          App.el('th', { scope: 'col', class: 'num', text: 'Tuition / month' })
        ])
      ])
    ]);

    const body = App.el('tbody');
    summary.forEach(function (row) {
      body.appendChild(App.el('tr', {}, [
        App.el('th', { scope: 'row', text: row.className }),
        App.el('td', { class: 'num', text: String(row.sectionCount) }),
        App.el('td', { class: 'num', text: fmt.number(row.totalStudents) }),
        App.el('td', { class: 'num', text: fmt.number(row.boys) }),
        App.el('td', { class: 'num', text: fmt.number(row.girls) }),
        App.el('td', { class: 'num', text: fmt.currency(row.monthlyFee) })
      ]));
    });
    table.appendChild(body);

    mount.appendChild(App.el('details', { class: 'mt-1' }, [
      App.el('summary', { class: 'text-sm text-muted', text: 'Show the class table' }),
      table
    ]));
  }

  /* ======================================================================
   * ATTENDANCE — LAST 7 SCHOOL DAYS (inline SVG line chart)
   * ==================================================================== */
  function renderTrend() {
    const mount = App.qs('#trend-panel');
    const trend = helpers.getAttendanceTrend(TREND_DAYS);
    const today = helpers.getAttendanceToday();

    const average = trend.reduce(function (sum, day) { return sum + day.percent; }, 0) / trend.length;
    const best = trend.reduce(function (top, day) { return day.percent > top.percent ? day : top; }, trend[0]);
    const worst = trend.reduce(function (low, day) { return day.percent < low.percent ? day : low; }, trend[0]);

    App.qs('#trend-caption').textContent = 'Average ' + average.toFixed(1) + '% over '
      + trend.length + ' school days • best ' + best.weekdayShort + ' ' + best.dayOfMonth
      + ' (' + best.percent.toFixed(1) + '%) • lowest ' + worst.weekdayShort + ' ' + worst.dayOfMonth
      + ' (' + worst.percent.toFixed(1) + '%)';

    const chart = App.lineChart(
      trend.map(function (day, index) {
        return {
          label: day.weekdayShort + ' ' + day.dayOfMonth,
          value: day.percent,
          highlight: index === trend.length - 1
        };
      }),
      {
        label: 'Attendance for the last ' + trend.length + ' school days',
        min: 0,
        max: 100,
        format: function (value) { return Number(value).toFixed(1) + '%'; }
      }
    );

    const breakdown = App.el('details', { class: 'mt-1' }, [
      App.el('summary', { class: 'text-sm text-muted', text: 'Show the daily breakdown' }),
      App.el('div', { class: 'table-scroll' }, [
        App.el('table', { class: 'table table--compact' }, [
          App.el('caption', { class: 'sr-only', text: 'Daily attendance for the last ' + trend.length + ' school days' }),
          App.el('thead', {}, [
            App.el('tr', {}, [
              App.el('th', { scope: 'col', text: 'Day' }),
              App.el('th', { scope: 'col', class: 'num', text: 'Present' }),
              App.el('th', { scope: 'col', class: 'num', text: 'Late' }),
              App.el('th', { scope: 'col', class: 'num', text: 'Absent' }),
              App.el('th', { scope: 'col', class: 'num', text: 'Leave' }),
              App.el('th', { scope: 'col', class: 'num', text: 'Attendance' })
            ])
          ])
        ])
      ])
    ]);

    const table = breakdown.querySelector('table');
    const body = App.el('tbody');
    trend.forEach(function (day) {
      body.appendChild(App.el('tr', {}, [
        App.el('th', { scope: 'row', text: day.weekday + ' ' + day.dayOfMonth + ' ' + day.monthShort + (day.isToday ? ' (today)' : '') }),
        App.el('td', { class: 'num', text: fmt.number(day.present) }),
        App.el('td', { class: 'num', text: fmt.number(day.late) }),
        App.el('td', { class: 'num', text: fmt.number(day.absent) }),
        App.el('td', { class: 'num', text: fmt.number(day.leave) }),
        App.el('td', { class: 'num', text: day.percent.toFixed(1) + '%' })
      ]));
    });
    table.appendChild(body);

    App.clear(mount);
    mount.appendChild(chart);
    mount.appendChild(App.el('div', { class: 'chip-list mt-1' }, [
      chip('Average', average.toFixed(1) + '%', 'info'),
      chip('Today', today.percent.toFixed(1) + '%', today.percent >= 90 ? 'success' : 'warning'),
      chip('Present today', fmt.number(today.present), 'success'),
      chip('Absent today', fmt.number(today.absent), 'danger')
    ]));
    mount.appendChild(breakdown);
  }

  /* ======================================================================
   * FEE OVERVIEW — paid vs pending for the current month
   * ==================================================================== */
  function renderFees() {
    const mount = App.qs('#fee-panel');
    const monthly = helpers.getMonthlyFeeSummary();
    const session = Data.getFeeSummary();

    /* The badge says which session the surrounding figures belong to — a bare
       "2026-2027" would not say that on its own. */
    App.qs('#fee-session-badge').textContent = 'Session ' + session.session;
    App.qs('#fee-caption').textContent = 'Paid against pending for ' + monthly.monthName
      + ' • month ' + monthly.monthsElapsed + ' of ' + monthly.totalMonths;

    const donut = App.donutSegments([
      { label: 'Collected', value: monthly.collected, color: COLOURS.paid },
      { label: 'Pending', value: monthly.pending, color: COLOURS.pending }
    ], {
      centerValue: monthly.percent.toFixed(0) + '%',
      centerLabel: 'collected',
      label: monthly.monthName + ' fee collection',
      /* Money in this legend, not a bare grouped integer. */
      format: fmt.currency
    });

    const wrapper = App.el('div', {}, [donut]);
    wrapper.appendChild(App.el('div', { class: 'mt-1' }, [
      App.metaList([
        [monthly.monthName + ' bill', fmt.currency(monthly.billed)],
        ['Collected', fmt.currency(monthly.collected)],
        ['Pending', fmt.currency(monthly.pending)],
        ['Session collected', fmt.currency(session.collected) + ' of ' + fmt.currency(session.expected)],
        ['Late fine', monthly.lateFinePercent + '% per month on outstanding']
      ])
    ]));

    const weakest = monthly.byClass.slice().sort(function (a, b) { return a.percent - b.percent; }).slice(0, 3);
    const meters = App.el('div', { class: 'mt-1' });
    meters.appendChild(App.el('p', {
      class: 'text-xs text-muted font-semibold', text: 'Lowest collection this month'
    }));
    weakest.forEach(function (row) {
      meters.appendChild(App.meter({
        label: row.className,
        percent: row.percent,
        text: fmt.currency(row.pending) + ' pending',
        tone: row.percent < 75 ? 'danger' : 'warning'
      }));
    });

    App.clear(mount);
    mount.appendChild(wrapper);
    mount.appendChild(meters);
  }

  /* ======================================================================
   * GENDER DISTRIBUTION — two-segment donut
   * ==================================================================== */
  function renderGender() {
    const mount = App.qs('#gender-panel');
    const gender = helpers.getGenderSummary();

    App.qs('#gender-caption').textContent = fmt.number(gender.school.total)
      + ' students on the roll • ' + gender.school.boyPercent + '% boys, '
      + gender.school.girlPercent + '% girls';

    App.clear(mount);
    mount.appendChild(App.donutSegments([
      { label: 'Boys', value: gender.school.boys, color: COLOURS.male },
      { label: 'Girls', value: gender.school.girls, color: COLOURS.female }
    ], {
      centerValue: fmt.number(gender.school.total),
      centerLabel: 'students',
      label: 'Gender distribution across the school'
    }));

    const stages = App.el('div', { class: 'mt-1' });
    stages.appendChild(App.el('p', {
      class: 'text-xs text-muted font-semibold', text: 'Split by stage'
    }));
    gender.byStage.forEach(function (stage) {
      stages.appendChild(App.meter({
        label: stage.stage,
        percent: stage.boyPercent,
        text: fmt.number(stage.boys) + ' / ' + fmt.number(stage.girls),
        tone: 'info'
      }));
    });
    mount.appendChild(stages);
  }

  /* ======================================================================
   * RECENT ACTIVITIES — timeline
   * ==================================================================== */
  function renderActivities() {
    const mount = App.qs('#activity-panel');
    const items = helpers.getRecentActivity(ACTIVITY_COUNT);

    const timeline = App.el('div', { class: 'timeline timeline--activity' });
    items.forEach(function (item) {
      const style = ACTIVITY_STYLE[item.kind] || { icon: 'info', tone: 'info' };
      timeline.appendChild(App.el('div', { class: 'timeline__item' }, [
        App.el('div', { class: 'activity' }, [
          App.el('span', {
            class: 'activity__icon activity__icon--' + style.tone,
            html: App.icon(style.icon, 'icon--sm')
          }),
          App.el('div', { class: 'activity__body' }, [
            App.el('span', { class: 'activity__title', text: item.title }),
            App.el('span', { class: 'activity__detail', text: item.detail })
          ]),
          App.el('span', { class: 'activity__when', text: fmt.date(item.date, 'medium') })
        ])
      ]));
    });

    App.qs('#activity-caption').textContent = items.length + ' events, newest first • from admissions, '
      + 'announcements, exams, assignments, the roll call and the fee ledger';

    App.clear(mount);
    mount.appendChild(timeline);
  }

  /* ======================================================================
   * LATEST ANNOUNCEMENTS
   * ==================================================================== */
  function renderAnnouncements() {
    const mount = App.qs('#announcements-list');
    const all = helpers.getAnnouncements().slice().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return a.publishedDate < b.publishedDate ? 1 : -1;
    });
    const items = all.slice(0, ANNOUNCEMENT_COUNT);
    const important = all.filter(function (item) { return item.priority === 'Important'; }).length;

    items.forEach(function (item) {
      mount.appendChild(App.el('article', { class: 'list-row' }, [
        App.el('div', { class: 'list-row__main' }, [
          App.el('span', { class: 'list-row__title', text: item.title }),
          App.el('div', { class: 'list-row__meta' }, [
            /* The priority badge is the point of this row: 'Important' renders
               in the shared purple pill, 'Urgent' in red, 'Normal' in blue. */
            App.badge(item.priority),
            App.el('span', { text: item.category }),
            App.el('span', { text: item.audience }),
            App.el('span', { text: fmt.date(item.publishedDate, 'medium') })
          ])
        ])
      ]));
    });

    mount.appendChild(App.el('div', { class: 'chip-list mt-1' }, [
      chip('Important', String(important), 'purple'),
      chip('Total notices', String(all.length), 'info')
    ]));
  }

  /* ======================================================================
   * UPCOMING EXAMS — subject + class + date + time
   * ==================================================================== */
  /**
   * Collapses the flat paper list into sittings — one entry per subject on a
   * day, carrying the classes it runs for.
   *
   * A flat preview is unreadable: the first sitting of an exam covers every
   * class, so the first seven papers would all read "English, 20 Dec, 08:30"
   * and differ only in the class name. Grouping keeps the same four facts per
   * row (subject, class, date, time) while making each row a distinct event.
   *
   * Input is already sorted by date, then time, then class, so first-seen order
   * is the chronological order the card wants.
   */
  function groupSittings(papers) {
    const byKey = Object.create(null);
    const sittings = [];
    papers.forEach(function (paper) {
      const key = paper.examId + '|' + paper.date + '|' + paper.time + '|' + paper.subject;
      let sitting = byKey[key];
      if (!sitting) {
        sitting = byKey[key] = {
          examId: paper.examId,
          examName: paper.examName,
          status: paper.examStatus,
          subject: paper.subject,
          date: paper.date,
          time: paper.time,
          classes: []
        };
        sittings.push(sitting);
      }
      if (sitting.classes.indexOf(paper.className) === -1) sitting.classes.push(paper.className);
    });
    return sittings;
  }

  /** "Playgroup to Grade 10", or "Grade 3 - B, Grade 3 - C" for a short list. */
  function describeClasses(classes) {
    if (classes.length === 1) return classes[0];
    if (classes.length <= 3) return classes.join(', ');
    return classes[0] + ' to ' + classes[classes.length - 1];
  }

  function renderExams() {
    const mount = App.qs('#exams-list');
    const today = helpers.getAttendanceToday().date;
    /* Statuses come from the calendar in data.js, so "upcoming" here and the
       exams module can never disagree. `fromDate` drops sittings already sat. */
    const papers = helpers.getExamPapers({ status: ['Upcoming', 'Ongoing'], fromDate: today });

    if (!papers.length) {
      mount.appendChild(App.emptyState({
        icon: 'calendar',
        title: 'No exams scheduled',
        message: 'Every examination in this session has already been sat.'
      }));
      return;
    }

    const sittings = groupSittings(papers);
    const examsInPlay = [];
    sittings.forEach(function (sitting) {
      if (examsInPlay.indexOf(sitting.examId) === -1) examsInPlay.push(sitting.examId);
    });

    App.qs('#exams-caption').textContent = fmt.number(papers.length) + ' papers in '
      + fmt.number(sittings.length) + ' sittings across ' + examsInPlay.length
      + ' examination' + (examsInPlay.length === 1 ? '' : 's')
      + ' • showing the next ' + EXAM_PREVIEW_COUNT;

    sittings.slice(0, EXAM_PREVIEW_COUNT).forEach(function (sitting) {
      const classText = describeClasses(sitting.classes);
      mount.appendChild(App.el('article', { class: 'exam-row' }, [
        App.el('span', { class: 'exam-row__subject', text: sitting.subject }),
        App.el('span', {
          class: 'exam-row__class',
          title: sitting.classes.join(', '),
          text: classText + (sitting.classes.length > 3 ? ' (' + sitting.classes.length + ')' : '')
        }),
        App.el('span', { class: 'exam-row__when' }, [
          App.iconNode('calendar', 'icon--sm'),
          App.el('span', { text: fmt.date(sitting.date, 'medium') })
        ]),
        App.el('span', { class: 'exam-row__when' }, [
          App.iconNode('clock', 'icon--sm'),
          App.el('span', { text: sitting.time })
        ]),
        App.badge(sitting.status)
      ]));
    });

    if (sittings.length > EXAM_PREVIEW_COUNT) {
      mount.appendChild(App.el('p', { class: 'text-xs text-muted mt-1', text:
        'Showing the next ' + EXAM_PREVIEW_COUNT + ' of ' + fmt.number(sittings.length)
        + ' sittings — ' + fmt.number(papers.length) + ' papers in all, one per class.' }));
    }

    /* The full schedule is 360 rows, so it is built on first open rather than
       with the rest of the card. */
    mount.appendChild(buildExamSchedule(papers));
  }

  /** Disclosure holding the whole paper schedule, built on first toggle. */
  function buildExamSchedule(papers) {
    const wrapper = App.el('div', { class: 'table-scroll mt-1' });
    const details = App.el('details', {}, [
      App.el('summary', {
        class: 'text-sm text-muted',
        text: 'Show the full paper schedule (' + fmt.number(papers.length) + ' papers)'
      })
    ]);
    let built = false;

    const build = function () {
      if (built) return;
      built = true;
      const table = App.el('table', { class: 'table table--compact' }, [
        App.el('caption', { class: 'sr-only', text: 'Every exam paper with subject, class, date and time' }),
        App.el('thead', {}, [
          App.el('tr', {}, [
            App.el('th', { scope: 'col', text: 'Date' }),
            App.el('th', { scope: 'col', text: 'Time' }),
            App.el('th', { scope: 'col', text: 'Subject' }),
            App.el('th', { scope: 'col', text: 'Class' }),
            App.el('th', { scope: 'col', text: 'Examination' })
          ])
        ])
      ]);
      const body = App.el('tbody');
      papers.forEach(function (paper) {
        body.appendChild(App.el('tr', {}, [
          App.el('th', { scope: 'row', text: fmt.date(paper.date, 'medium') }),
          App.el('td', { class: 'tabular', text: paper.time }),
          App.el('td', { text: paper.subject }),
          App.el('td', { text: paper.className }),
          App.el('td', { text: paper.examName })
        ]));
      });
      table.appendChild(body);
      wrapper.appendChild(table);
    };

    details.addEventListener('toggle', function () {
      if (details.open) build();
    });
    details.appendChild(wrapper);
    return details;
  }

  /* ======================================================================
   * SHARED SMALL PIECE
   * ==================================================================== */
  function chip(label, value, tone) {
    return App.el('span', { class: 'badge badge--' + tone }, [
      App.el('span', { text: label + ': ' }),
      App.el('strong', { text: value })
    ]);
  }

  /* ======================================================================
   * INIT
   * ==================================================================== */
  document.addEventListener('app:ready', function () {
    renderBanner();
    renderKpis();
    renderStrength();
    renderTrend();
    renderFees();
    renderGender();
    renderActivities();
    renderAnnouncements();
    renderExams();
  });

}(window));