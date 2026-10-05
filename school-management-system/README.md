# Mother's Lap School System

A responsive **School Management System** front-end prototype for
**Mother's Lap School System**, Hyderabad, Sindh (Playgroup to Grade 10).

Built with plain **HTML5, CSS3 and vanilla JavaScript (ES6+)** — no frameworks,
no build tools, no backend. Open `index.html` in any modern browser and it runs.

> **Demo data only.** Every student, teacher, phone number, e-mail address and
> address in this project is fictional. The dataset is produced by a seeded
> pseudo-random generator, so it is identical on every page load. No real
> student information is used, stored or transmitted anywhere.

---

## How to run

1. Download or copy the `school-management-system` folder.
2. Double-click **`index.html`** (or right-click → *Open with* → any modern
   browser: Chrome, Edge, Firefox, Safari).
3. That is it — no install, no server, no build step.

Because the app uses plain `<script>` tags (no ES modules), it also works when
opened straight from the file system (`file://`). Some browsers restrict
`localStorage` on `file://`; preferences and saved attendance marks then simply
fall back to in-memory behaviour.

The only network request is the **Inter** webfont from Google Fonts. It is
loaded with `display=swap` behind a full system-font fallback, so the prototype
looks and behaves identically with no internet connection — you just see the
fallback typeface instead of Inter.

### Optional: serve it over HTTP

```bash
# Python
cd school-management-system
python -m http.server 8000
# then open http://localhost:8000
```

---

## Folder structure

```
school-management-system/
├── index.html              Dashboard
├── README.md               This file
├── pages/                  All other pages
│   ├── students.html       Student register (paginated, searchable)
│   ├── teachers.html       Staff directory
│   ├── classes.html        Classes, sections, subjects, class teachers
│   ├── attendance.html     Daily class register (present / absent / leave / late)
│   ├── assignments.html    Assignment board
│   ├── exams.html          Examinations & results
│   ├── fees.html           Fee structure (PKR) & collection
│   ├── announcements.html  Notice board
│   └── settings.html       School profile, session & preferences
├── css/
│   ├── style.css           Design system, components, mobile baseline
│   └── responsive.css      Breakpoints: 480 / 640 / 768 / 1024 / 1280 / 1536
├── js/
│   ├── data.js             ALL demo data + helpers + console self-check
│   ├── app.js              App shell, shared helpers, reusable data table
│   ├── students.js         Student register page logic
│   ├── attendance.js       Attendance register page logic
│   └── dashboard.js        Dashboard page logic
└── assets/
    ├── images/             logo.svg, campus.svg
    └── icons/              favicon.svg
```

---

## Scripts and load order

Every page loads the same three-or-more scripts at the end of `<body>`:

```html
<script src="[base]js/data.js"></script>   <!-- demo data, must be first  -->
<script src="[base]js/app.js"></script>    <!-- shell + shared helpers     -->
<script src="[base]js/<page>.js"></script> <!-- page module (if any)      -->
```

`[base]` is empty on `index.html` and `../` inside `pages/`. It is declared once
per page as `<body data-base="...">` and read by `app.js`, so relative paths
work from every page.

Each page also declares `data-page="..."`; `app.js` uses it to highlight the
active navigation item and to build the topbar title.

---

## Demo dataset (single source of truth)

Everything is generated in **`js/data.js`** and exposed on `window.SchoolData`.

| Item | Value |
| --- | --- |
| Students | **2,000** (Playgroup → Grade 10) |
| Teachers | **50** |
| Classes | **13** (Playgroup, Nursery, Prep, Grade 1 … Grade 10) |
| Sections | **52** (A, B, C, D per class, **30–40** students each, summing to exactly 2,000) |
| Subjects | **15** |
| Currency | **PKR** |
| School year | **April → March** (session label derived from the current date, e.g. `2026-2027`) |
| Phone format | `03XX-XXXXXXX` |
| E-mail domain | `*@motherslapschool.edu.pk` (fictional) |
| Addresses | Hyderabad, Sindh (Latifabad, Qasim Nagar, Hirabad, Jamshoro, Kotri, …) |

### Curriculum rules

* Primary classes (Playgroup → Grade 5) get age-appropriate subjects only.
* **Physics, Chemistry, Biology and Pakistan Studies** are taught in
  **Grade 6 to Grade 10 only**.
* Every subject on a class timetable has exactly one teacher per section.
* Every section has a **class teacher**; no teacher is booked twice in the same
  section, and each teacher takes at most two subjects per section.

### Student record fields

`id`, `grNo`, `name`, `firstName`, `lastName`, `gender`, `className`, `classId`,
`sectionName`, `sectionId`, `rollNo` (unique per section), `age`,
`dateOfBirth` (matches class age), `admissionDate`, `guardian`,
`guardianRelation`, `phone`, `address`, `attendance` (%), `feeStatus`,
`feeExpected`, `feePaid`, `feeBalance`, `status`, `bloodGroup`, `transport`.

### Teacher record fields

`id`, `staffId`, `name`, `gender`, `mainSubject`, `canTeach` (subjects they can
take), `qualification`, `experience`, `designation`, `phone`, `email`,
`joiningDate`, `address`, `assignedClassSections` (e.g. `Grade 3 - B · English`),
`sectionCount`, `classTeacherOf`, `subjects`, `status`.

---

## `window.SchoolData`

| Property | Contents |
| --- | --- |
| `school` | Name, tagline, address, phone, e-mail, principal, timings, session |
| `session` | `{ label, startDate, endDate, startYear, currentMonthIndex, progress }` |
| `classes` | 13 class objects (`name`, `code`, `stage`, `sections`, `subjects`, …) |
| `sections` | 52 section objects (`id` like `G3-B`, `classTeacherId`, `roster`, `students`) |
| `subjects` | 15 subject objects (`name`, `code`, `group`, `seniorOnly`) |
| `curriculum` | Class name → array of subject names |
| `students` | 2,000 student objects |
| `teachers` | 50 teacher objects |
| `fees` | Currency, frequency, late fine, discounts, per-class structures |
| `exams` | 6 examinations with dates, classes, subjects, weightage |
| `assignments` | Seeded assignment records with submission progress |
| `announcements` | 10 notices with audience, priority and published date |
| `totals` | Headline counts used across the UI |
| `helpers` | All helper functions (see below) |

### Helper functions

```js
SchoolData.getStudentsByClass('Grade 5');      // all Grade 5 students
SchoolData.getStudentsByClass('Grade 5', 'B');  // one section only
SchoolData.getStudentsByClass();                 // all 2,000 students
SchoolData.getTeacherById('TCH-014');            // one teacher
SchoolData.getClassSummary();                    // one roll-up row per class
SchoolData.getFeeSummary();                      // PKR collection roll-up

SchoolData.helpers.getSections('Grade 5');       // sections of a class
SchoolData.helpers.getClassSubjects('Grade 5');  // timetable of a class
SchoolData.helpers.getClassTeacher('Grade 5', 'B');
SchoolData.helpers.getSubjectAllocation('Grade 5', 'B');   // teachers + subjects
SchoolData.helpers.getFeeStructure('Grade 5');
SchoolData.helpers.getAttendanceToday();         // whole-school roll call
SchoolData.helpers.getSectionAttendance('Grade 5', 'B', '2026-10-04');
SchoolData.helpers.getSectionAttendanceMatrix('Grade 5', 'B', 22); // month view
SchoolData.helpers.formatPKR(4500);              // "Rs 4,500"
SchoolData.helpers.formatDate('2026-10-04', 'long');
SchoolData.helpers.initials('Ali Raza');         // "AR"
```

Only the five legacy calls above are exported at the top level; **everything
else must be reached through `SchoolData.helpers`**. That keeps one obvious
entry point for the 45 helper functions and keeps page scripts from inventing
their own roll-ups.

### Student record mutations (added with Add/Edit/Delete)

Writing goes through `SchoolData.helpers` — never by reaching into
`Data.students` from a page script:

```js
const created = SchoolData.helpers.addStudent({ name: 'Zainab Khan', className: 'Grade 5', ... });
const updated = SchoolData.helpers.updateStudent('STU-0146', { rollNo: '43' });
SchoolData.helpers.removeStudent('STU-0146');

SchoolData.helpers.nextStudentNumber();                 // 'GR-2026-2001'
SchoolData.helpers.nextRollNo('Grade 5', 'A');         // next free roll in that section
SchoolData.helpers.isRollNoTaken('Grade 5', 'A', 41);   // true
SchoolData.helpers.recountStudents();                   // force a recount
```

A write is a single transaction. Each one regroups the record out of its old
section and into its new one, updates the denormalised
`sections[].students / boys / girls` and `classes[].studentCount / boys /
girls` figures, and re-runs the totals — so the register, the summary cards,
the dashboard KPIs, the class summary, the fee roll-up and the gender split all
move together from one call. No page reload, and no second call to remember.

`addStudent` also derives the fields a new record has no history for: the GR
number, the roll number, and an **attendance percentage** computed by running
the normal `attendanceOf()` rule over the last 30 school days (present + late
counts as attending). Without that, a new row would render as 0% and drag the
dashboard trend down for a student who has never actually been absent.

`updateStudent` accepts the old values as the default for any field left out,
so a form can send only what it changed. `removeStudent` splices the array and
then re-derives everything from the remaining records, which is why
`STUDENT_INDEX` maps **id → record object** rather than id → array position: an
index into an array that a splice has just shifted would silently resolve the
wrong student.

### Dashboard helpers (added with the dashboard)

| Helper | Returns |
| --- | --- |
| `getMonthlyFeeSummary()` | `{ currency, session, monthIndex, monthName, billed, collected, pending, percent, monthsElapsed, byStatus, byClass, lateFinePercent }` for the current month. `billed === collected + pending` is asserted by the self-check |
| `getExamPapers({ examId, status, fromDate, className, subject })` | Individual sittings as subject × class × date × time, in date-then-time order. 672 rows for the whole session; the dashboard asks for `status: ['Upcoming','Ongoing'], fromDate: today` and gets **360** |
| `getAttendanceTrend(days)` | The last *n* **school** days, ascending, ending today: `{ date, weekday, weekdayShort, dayOfMonth, monthShort, percent }`. Fridays are skipped (weekly break) |
| `getGenderSummary()` | `{ school: { total, boys, girls, boyPercent, girlPercent }, byStage: [...], byClass: [...] }` — every part reconciles to the 2,000 total |
| `getRecentActivity(limit)` | Merged, dated, newest-first feed of admissions, announcements, exams, assignments, today's roll call and the fee position. Each item carries a `kind`; the page maps that to an icon and tone. 15 candidates, 8 shown |

Two of these deserve a note, because both are derived rather than invented:

* **Monthly fees.** The demo ledger stores one cumulative `feePaid` figure per
  student, so a single month cannot simply be read off it. A month's bill is the
  class's `structure.monthlyTuition`, and the collected slice of it is
  `min(monthlyTuition, round(feePaid / monthsElapsed))`. Nothing is fabricated
  per-month history.
* **Recent activity.** Items dated after today are excluded. An exam starting in
  February 2027 belongs on the *upcoming exams* card, not in a list of things
  that have already happened — and the self-check enforces that.

### Exam status is derived, never typed

`exam.status` is computed from the session calendar at build time
(`Completed` / `Ongoing` / `Upcoming`) rather than written into the literals, so
it cannot drift out of step with the exam's own dates. The exam windows sit
inside the April→March session by construction, which the self-check asserts.

---

## Console self-check

`js/data.js` runs **30** validation checks on every page load and prints a
collapsible table in the browser console (look for
**"Mother's Lap School System — data self-check"**):

```
✓ students = 2000  •  teachers = 50  •  sum of section sizes = 2000  •  sections = 52  •  subjects = 15
```

The first 17 are structural: student/teacher totals, section-size sum and range
(30–40), unique ids, unique GR numbers, unique roll numbers per section, a class
teacher in every section, **no teacher double-booked**, every class-subject
staffed, senior subjects restricted to Grade 6–10, fee structure for all classes,
and phone format.

The remaining 13 were added with the dashboard, and each one exists because a
dashboard figure could otherwise be quietly wrong:

| Check | Guards against |
| --- | --- |
| Gender split totals 2,000 | A donut that does not add up to the roll |
| Gender by stage/class reconciles | A per-stage breakdown disagreeing with the total |
| Monthly fee bill reconciles | `billed ≠ collected + pending` — an invented bill |
| Monthly bill = one month of tuition | The bill drifting away from the fee structure |
| Collection never exceeds the bill | Collecting more than was billed |
| Trend returns 7 Friday-free days | A "7-day" chart that silently spans a weekly break |
| Trend ends on today | A stale chart with no current day on it |
| Papers carry subject + class + date + time | A row missing the data needed to plan a sitting |
| Papers are in date/time order | An unusable schedule |
| Every sitting is inside its exam window | A paper dated outside the exam that contains it |
| Exam status matches the calendar, inside the session | Hand-typed statuses going stale, exams outside April→March |
| ≥6 dated activity items, newest first | A thin or misordered feed |
| No activity dated in the future | The "recent" list listing things that have not happened |

You can re-run it at any time:

```js
SchoolData.runSelfCheck();   // or click "Run data self-check" in Settings
```

---

## `window.App` (shared helpers, `js/app.js`)

| Helper | Purpose |
| --- | --- |
| `App.el(tag, attrs, children)` | Create elements (no innerHTML string building) |
| `App.qs` / `App.qsa` / `App.clear` / `App.escapeHtml` | DOM utilities |
| `App.icon(name, className)` | Inline SVG markup for one of the `ICONS` glyphs, as a string |
| `App.iconNode(name, className)` | The same glyph as a ready element — what to append when building DOM |
| `App.debounce(fn, 250)` | Debounced search input |
| `App.format` | `currency`, `number`, `date`, `phone`, `initials`, `percent` |
| `App.badge`, `App.badgeClass`, `App.emptyState`, `App.statCard`, `App.meter`, `App.donut`, `App.donutSegments`, `App.barChart`, `App.lineChart`, `App.metaList` | UI building blocks (`App.meter` renders a `.meter-row` wrapping a `.progress` bar) |
| `App.countUp(node, opts)`, `App.runCountUps(duration)`, `App.prefersReducedMotion()` | Animated figure count-up (see below) |
| `App.createDataTable(options)` | **Reusable table:** debounced search, filters, sortable columns, pagination, CSV export |
| `App.toast(message, type)` | Transient status message |
| `App.modal({ title, content, actions })` | Shared dialog (Escape / backdrop close / focus trap / focus return) |
| `App.closeModal()`, `App.isModalOpen()` | Close the dialog; ask whether one is showing |
| `App.confirm({ title, message, note, confirmLabel, variant, onConfirm })` | **Destructive-action dialog.** Focus starts on **Cancel**, and `onConfirm` may `return false` to veto |
| `App.validators` | `required`, `lettersOnly`, `digitsOnly`, `phone`, `minLength`, `range`, `matches`, `custom`, `compose` |
| `App.formField(field)` | One labelled control with a hint slot and an `aria-describedby`-linked error slot |
| `App.formModal({ title, fields, submitLabel, onSubmit })` | A validated form in the shared dialog (see below) |
| `App.panel({ title, content, actions })`, `App.closePanel()` | Right-hand **side panel** for a record detail (see [Side panel](#side-panel)) |
| `App.storage` | `localStorage` wrapper with the `mls.` prefix |
| `App.settings` | Interface preferences (density, sidebar, rows per page) |
| `App.pageMeta()`, `App.setTitle()` | Page title helpers |
| `App.NAV`, `App.user`, `App.mountShell()` | The shell template (see below) |
| `App.globalSearch(query)` | Topbar search: `{ query, tooShort, total, counts, results[] }` |
| `App.LAYOUT`, `App.layout`, `App.onLayoutChange(fn)`, `App.refreshLayout()` | Breakpoint awareness for the drawer (see [Responsive behaviour](#responsive-behaviour)) |

### One form helper, so validation is never re-invented

`App.validators.compose(...)` is the whole point of the set. Each validator
returns `null` or a message; composing them means a field can require an input
*and* constrain its shape without a nested `if`, and the first failure is the
message the reader sees:

```js
rules: App.validators.compose(
  App.validators.required('Student name'),
  App.validators.lettersOnly('Student name'),
  App.validators.minLength(3)
)
```

`App.formModal` then wires up the behaviour that is easy to get subtly wrong:

* Validation runs on `input` and on `change`, and **disables submit** while the
  form is invalid — so the button is never a lie about whether it will work.
* An invalid field gets `.is-invalid`, `aria-invalid="true"` and its error
  message written into a `role="alert"` slot that is already referenced by
  `aria-describedby`. Nothing is announced twice.
* Because submit is disabled, the form also carries a **`.sr-only`
  `type="submit"` button**. Enter still fires the submit handler, which reveals
  *every* message and focuses the first bad field — otherwise a reader who
  presses Enter would get nothing at all.
* `field.dynamic: true` re-fills a dependent control when an earlier field
  changes (the Section options follow the chosen Class).

### Animated count-up

`App.statCard({ count: { to, format, duration } })` renders the **final**
formatted string first and only then animates from zero. That ordering is the
whole point: anything which never runs the animation — printing the page, a
text-only reader, a browser without `requestAnimationFrame`, reduced motion — is
showing the correct figure, because the correct figure was never removed.

```js
App.statCard({
  label: 'Total students',
  value: '2,000',                       // used when `count` is absent
  count: { to: totals.students, format: App.format.number, duration: 900 }
});
App.runCountUps(900);                   // drains App.countUpQueue
```

* `to` is also written to `data-count-up` on the value node, so the DOM records
  the target declaratively. The **formatter** lives on `App.countUpQueue`
  instead, because a function cannot be an attribute value.
* `runCountUps()` staggers the cards (`min(90, duration / 8)` ms apart) so six
  figures resolve left to right rather than all at once. The delay is passed as
  `opts.startIn`; it is capped so it stays well inside the animation itself.
* `App.countUp()` uses an ease-out curve, stops on a **detached** node rather
  than running a runaway loop, and returns a `cancel()` that is safe to call
  repeatedly and always leaves the true figure behind.
* `duration: 0` means "do not animate" and requests no frames at all — note that
  `Number(0) || 900` would silently have produced 900.
* Every path out of `App.countUp()` that does not animate (no node, no rAF,
  reduced motion, zero duration) writes the true figure, so the three exits
  cannot disagree with `cancel()`.
* `App.statCard()` ignores a `count` whose `to` is not a finite number and falls
  back to the plain `value`, rather than printing `undefined` into the KPI row.
* `App.prefersReducedMotion()` asks `matchMedia` on **every** call rather than
  caching the answer, so flipping the OS setting while the page is open is
  honoured immediately.

### Charts without a library

| Primitive | How it works |
| --- | --- |
| `App.barChart(items)` | Pure CSS — each column is a `.bar-chart__col` whose height is a percentage of a fixed-height track |
| `App.donutSegments(segments, opts)` | Builds a `conic-gradient` from **token strings** the caller supplies (`var(--blue-500)`, …). No colour literal is ever written into the gradient, so the donut re-themes with the rest of the UI |
| `App.lineChart(points, opts)` | Inline `<svg>` shape plus an HTML marker/label layer positioned in percentages |

Two deliberate choices in `lineChart` are worth keeping:

* The SVG uses `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` and
  `vector-effect="non-scaling-stroke"`, so the plot scales to its container while
  the stroke stays 2px. **Text is not inside the SVG** — inside a non-uniformly
  scaled viewBox, glyphs are stretched with the shape. Labels and markers are
  ordinary absolutely-positioned HTML.
* `.line-chart__labels` never wraps. A wrapped label would stop lining up with
  its marker; below 360px the type shrinks to 10px instead.

Both charts render a **single `role="img"` element with a full text summary**
("Gender distribution across the school: Boys 50.7%, Girls 49.3%"), so the
information survives without sight of the graphic. `donutSegments` takes a
`format` option for the legend figures, so a money chart reads "Rs 13,117,055"
rather than a bare integer.

### Side panel

`App.panel({ title, content, actions })` opens a record detail in a right-hand
drawer. It reuses the **same CSS contract as the mobile navigation drawer**
(`.drawer.drawer--right` over `.drawer__scrim`) but, unlike that drawer, exists
at every width — a student profile is worth a panel on a desktop too, where a
centred modal would cover the register the reader is comparing against.

It behaves like a dialog rather than a decoration:

* `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title, and the
  panel takes focus itself when it opens so the record's heading is announced.
* Escape closes it, the scrim closes it, and `Tab` is trapped inside it — the
  existing focus-trap handler now picks whichever of `#app-sidebar` /
  `#app-panel` is open.
* The footer is **hidden**, not merely empty, when a panel has no actions, so a
  read-only profile carries no dead bar.
* Re-pointing an open panel at another record deliberately does **not** close
  the panel first: doing that would release the scroll lock and hand focus back
  to the *previous* record's trigger before the new one was recorded.

**Focus on close** is the part worth copying. A closed `.drawer` is
`visibility: hidden`, so anything still focused inside it is inert and
unreachable — focus cannot simply be left there. `closePanel()` restores it to
the trigger, and falls back to `#main-content` when there is no usable trigger
(a mouse click on a non-focusable element, or a programmatic call, both leave
`<body>` active, and `<body>` cannot hold focus). `closeSidebar()` uses the same
shape with the hamburger as its fallback.

**Scroll locking is reference counted.** The modal, the panel and the sidebar
each lock the page behind them, and a bare `body.style.overflow = ''` from
whichever closed last would release the page while the others were still open.
`lockScroll()` / `unlockScroll()` count holds instead; `App.isScrollLocked()`
reports whether any is active. Each holder marks itself `was-open` so a repeated
open of the *same* overlay takes only one hold.

---

## Application shell

Every page contains only a skeleton plus `<div id="topbar-mount">` and
`<div id="footer-mount">`. `App.mountShell()` builds the sidebar, topbar and
footer from `App.NAV` and injects them, so the shell exists in exactly one
place and all ten pages stay in step.

Each page declares *which* page it is with two attributes on `<body>`:

```html
<body data-page="students" data-base="../">
```

* `data-page` matches an `App.NAV` item `id` and drives the active-link
  highlight — no page hard-codes its own nav.
* `data-base` is the prefix for asset and link paths (`''` on `index.html`,
  `'../'` inside `pages/`), which is what lets the sidebar, footer and global
  search resolve correctly from either directory level.

`boot()` is idempotent, so the shell can never be mounted twice into one
document.

### Sidebar

Inline SVG crest (`assets/images/logo.svg`), the brand name, and ten nav links
grouped as **Overview / Academics / Operations / System**:

| Group | Items |
| --- | --- |
| Overview | Dashboard |
| Academics | Students · Teachers · Classes & Subjects · Attendance · Assignments · Exams & Results |
| Operations | Fees · Announcements |
| System | Settings |

The active item gets both `aria-current="page"` and an `.is-active` class.

Below 768px the sidebar is a `.drawer--left` slide-over with a dimmed overlay
and a focus trap (see the `--drawer-width` token and the `.drawer` primitive).
From 768px up it becomes a permanent panel — see
[Responsive behaviour](#responsive-behaviour).

### Topbar

Page title and subtitle (from `App.pageMeta()`), the global search combobox, a
notification bell carrying a count badge of pinned announcements, and the
signed-in user from `App.user`:

```js
App.user = { name: 'Administrator', role: 'Administrator', initials: 'AD' };
```

### Global search

`App.globalSearch(query)` searches **`SchoolData.students` (2,000) and
`SchoolData.teachers` (50)** and returns the best few hits.

* Minimum two characters — one letter matches nearly every Sindhi name.
* Ranks prefix name hits above mid-name hits above metadata hits (GR number,
  roll number, class, section, subject, e-mail, staff ID).
* Students and teachers are ranked in separate pools and **interleaved**, so a
  name shared by a pupil and a member of staff shows both.
* At most `SEARCH_MAX_RESULTS` (8) options are ever turned into DOM nodes, so
  the dropdown size is independent of how many records match.
* The dropdown footer carries one "All *n* students match" / "All *n* teachers
  match" link per dataset, so the number on each link is the number that page
  will actually show.
* Follows the combobox pattern: `role="combobox"` + `aria-expanded` +
  `aria-activedescendant`, a `role="listbox"` of `role="option"` anchors,
  ↑/↓/Home/End to move, Enter to open, Escape to close (then to clear), and an
  `aria-live` region announcing the match count.
* Each option is a real `<a>`, so click, middle-click and ctrl-click behave
  natively, and it deep-links into the matching register
  (`pages/students.html?search=…`).

`App.createDataTable()` exposes `setSearch(query)` so a `?search=` deep link
pre-filters the table. `App.globalSearch()` is also callable directly from a
page script.

### Browser storage keys

Everything is namespaced with an `mls.` prefix and can be cleared from
*Settings → Reset preferences* or by clearing site data.

| Key | Contents |
| --- | --- |
| `mls.settings` | Interface preferences as one JSON object |
| `mls.attendance.<YYYY-MM-DD>.<sectionId>` | Saved attendance marks for one section on one date, e.g. `mls.attendance.2026-10-04.G5-A` |

The global search stores nothing — a query only lives in the URL
(`?search=…`), so results are shareable by copying the address.

### Performance rules used throughout

* Large lists are **never** rendered in one go — only the current page of rows is
  written to the DOM. The page size is chosen per page (`pageSize` /
  `pageSizes`); the student register uses 20 with 10/20/50 offered.
* Search input is **debounced** (250 ms).
* Sorting and filtering operate on arrays, then re-render a single page.
* Dashboard renders aggregates and short samples, not the full register.
* Attendance is derived from a hash of `(student id + date)` instead of storing
  a 2,000 × 30 matrix.

### The pager keeps keyboard focus

The pager is rebuilt wholesale on every render, because the page count follows
the filtered result set and the ellipsis window follows the current page. That
threw away the button the reader had just activated, dropping them on `<body>`
and forcing a full re-tab from the top of the page.

`renderPagination()` therefore captures the focused control's `aria-label`
before clearing and hands focus to its replacement afterwards — matching on the
generated label, which needs no escaping. If the match is now **disabled** (a
`Previous page` button on page 1) or has vanished, focus falls back to the
current-page button, which is always present.

### `App.el` handler wiring

`App.el(tag, attrs, children)` treats an `on*` key whose value is a **function**
as a listener (`node.addEventListener(name.slice(2), value)`); a string still
falls through to `setAttribute`, so inline-handler attributes keep working.

```js
App.el('button', { class: 'btn', onclick: onClick });   // fires
App.el('button', { onclick: 'alert(1)' });              // inline attribute
```

This is worth spelling out because the previous behaviour was a silent trap:
`onclick: fn` went to `setAttribute`, and an inline handler *attribute* holds
source text, so the function was stringified into `onclick="function () {…}"`
and never ran. Every `App.modal` / `App.panel` footer action was a dead button,
and nothing caught it because no test activated one.

---

## Responsive behaviour

`css/style.css` is the **mobile baseline**; `css/responsive.css` only ever
progressively enhances it. Every rule there is `min-width` (or an explicitly
narrow `max-width` band) — no `!important`, no mobile-last overrides.

### Three sidebar layouts

| Width | Sidebar | Hamburger | Cards per row |
| --- | --- | --- | --- |
| **< 768px** (mobile) | Hidden. Hamburger opens a slide-over drawer with a dimmed overlay | shown | 2 (1 below 360px) |
| **768–1023px** (tablet) | **Persistent icon-only rail**, 76px | hidden | **2** |
| **>= 1024px** (desktop) | **`position: fixed`**, full 264px (288px at >= 1536px) | hidden | 4 |

**Mobile drawer** — opens on hamburger click, closes on overlay click, the close
button, the `Escape` key, **and on any nav/brand link click**. The last one
matters: clicking the link for the page you are already on does not navigate, so
without it the drawer would stay open over the page the user just asked for. A
focus trap holds `Tab` inside the panel while it is open and returns focus to
the hamburger on close.

### One token drives the panel and its gutter

`--sidebar-current-width` is the single source of truth, set on `.app` by
`css/responsive.css` per breakpoint (`0px` / `--sidebar-rail-width` /
`--sidebar-width`). Both `.sidebar`'s `width` and `.app`'s `padding-left` read
it, so the panel and the space reserved for it cannot drift apart.

The gutter lives on `.app`, not `.shell`, because the footer is a **sibling** of
`.shell` — reserving it on `.shell` would let the fixed sidebar sit on top of
the footer.

### Sidebar state is remembered

*Settings → Sidebar* (`mls.settings.sidebar`) toggles `expanded` / `collapsed`,
surfaced as `data-sidebar` on `<html>`. **Desktop only**: the tablet rail is
already icon-only, and the mobile drawer is off-canvas, so the preference would
have nothing to control. In both icon-only modes the link labels and counts are
kept in the accessibility tree (visually hidden) so an icon-only link is still
announced as "Students" rather than "link".

### Breakpoint awareness in JS

CSS remains the source of truth for layout. `js/app.js` mirrors the two
breakpoints as `App.LAYOUT` (`tablet: 768`, `desktop: 1024`) purely so the
drawer can behave itself when the viewport changes:

* `App.layout` is `'mobile' | 'tablet' | 'desktop'`; `App.onLayoutChange(fn)`
  subscribes to changes.
* `<html data-layout="…">` publishes the current value — informational, and
  handy when inspecting the page.
* Crossing **up** out of the mobile range with the drawer open closes it and
  clears the `body` scroll lock, rather than leaving `.is-open` on a panel that
  is now a permanent rail.
* Detection prefers `matchMedia` (identical semantics to the CSS media queries)
  and falls back to `window.innerWidth`. `clientWidth` is deliberately **not**
  used: it excludes a classic scrollbar, so a 1024px window with a 15px
  scrollbar would classify as a tablet while the stylesheet already showed the
  desktop sidebar.

### Wide tables scroll in place

`.table-scroll` is the horizontal scroll container (`overflow-x: auto`,
`max-width: 100%`, `min-width: 0`, `overscroll-behavior-x: contain`). It carries
`tabindex="0"` `role="region"` and an `aria-label` so it can be scrolled from the
keyboard — WCAG asks for that wherever content overflows.

A dense table keeps a **floor width** so its columns do not crush on a phone,
and the wrapper scrolls instead of the page:

```css
.table { min-width: var(--table-min-width, 0px); }   /* 0 by default */
```

`App.createDataTable({ minTableWidth: 720 })` sets that floor per table (the
default for every generated data table); pass `0` for a narrow table that should
simply fill its card. The floor is a CSS variable, so it is still tokenised.

### No horizontal page scroll

The acceptance floor is **360px**, and no breakpoint may introduce page-level
sideways scrolling. The rules that keep that true:

* Wide data is contained by `.table-scroll`, never by growing the page.
* Flex/grid items holding wide content opt out of `min-width: auto` —
  `.card`, `.stat-card`, `.app__main`, `.bar-chart__col`.
* Long unbroken strings (e-mail addresses) wrap: `.table th, .table td` use
  `overflow-wrap: anywhere`.
* `.pagination` wraps: the 2,000-row students table renders up to nine buttons
  plus two ellipses, which is ~310px inside a ~312px card at 360px and tips over
  with a three-digit page number.
* Every `vw` width is a cap (`max-width`, `min()`) or subtracts the scrollbar
  (`calc(100vw - 32px)`); no fixed pixel width or `min-width` reaches 340px.
* No `html, body { overflow-x: hidden }` — that masks an overflow rather than
  fixing it, and breaks `position: sticky`.

### Other adaptations

* `pointer: coarse` raises tap targets to 44px (buttons, inputs, pagination).
* `prefers-reduced-motion: reduce` disables transitions and smooth scrolling.
* `forced-colors: active` restores borders and system colours.
* Landscape phones under 480px tall get a shorter sidebar and topbar.
* `max-width: 360px` trims chrome: single-column cards, tighter padding, and a
  page heading that takes the full topbar row.

---

## Design system

Everything visual lives in `css/style.css`, organised as a two-layer token
system plus class-based components. There are **no colour literals outside the
`:root` block** — every component reads a variable, so re-theming the whole
prototype means editing one block.

### Layer 1 — palette (raw values, only ever referenced from `:root`)

| Group | Variables |
| --- | --- |
| Navy | `--navy-950` … `--navy-600` (deep navy brand ramp) |
| Blue | `--blue-500`, `--blue-300`, `--blue-100`, `--blue-50` (soft blues) |
| White / gray | `--color-white`, `--color-bg`, `--color-bg-alt`, `--color-surface`, `--color-surface-alt`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-soft`, `--color-text-muted` |
| Status | `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-purple`, `--color-rose` (+ a `-soft` tint for each) |
| On-dark | `--on-dark-text`, `--on-dark-title`, `--on-dark-strong`, `--on-dark-muted`, `--on-dark-faint`, `--on-dark-link`, `--on-dark-border`, `--on-dark-surface{,-hover,-active}`, `--on-dark-scrim`, `--on-dark-translucent` |

The `--on-dark-*` group exists because the sidebar and drawer sit on the navy
gradient, so they need their own tinted text and surfaces instead of borrowing
light-theme grays.

### Layer 2 — semantic tokens (what components consume)

`--color-primary` / `-hover` / `-active`, `--color-heading`,
`--color-surface-inverse`, `--color-text-inverse`, `--color-accent{,-soft}`,
`--color-{success,warning,danger,info}-{soft,border,strong}`.

Components reference these, never the raw palette — so a brand change is a
one-line edit and the whole UI moves together.

### Non-colour tokens

| Group | Values |
| --- | --- |
| Spacing | 8px scale: `--space-half` 4, `--space-1` 8 … `--space-8` 80 |
| Radii | `--radius-xs` 4 → `--radius-xl` 20, plus `--radius-pill` |
| Shadows | `--shadow-xs` → `--shadow-lg`, plus `--focus-ring` |
| Typography | `--font-size-xs` 12 → `--font-size-2xl` 28; `--font-weight-normal|medium|semibold|bold` |
| Motion | `--ease-standard`, `--transition-fast` 120ms, `--transition` 180ms, `--transition-slow` 280ms |
| Metrics | `--sidebar-width` 264, `--sidebar-rail-width` 76, `--sidebar-current-width` (per breakpoint), `--drawer-width`, `--topbar-height`, `--content-max` |
| Breakpoints | `--bp-tablet` 768, `--bp-desktop` 1024 (documentary; mirrored as `App.LAYOUT`) |
| Tables | `--table-min-width` 0 (set per table by `App.createDataTable`) |

`[data-density="compact"]` (Settings toggle) re-maps the spacing scale only.

### Typeface

**Inter**, loaded from Google Fonts with `display=swap` and a full system
fallback stack (`Segoe UI`, `system-ui`, …, plus `Noto Nastaliq Urdu` for Urdu
text). If the CDN is slow, blocked, or the prototype runs offline, the page
renders immediately in the fallback — no invisible text.

### Components

| Component | Classes |
| --- | --- |
| Buttons | `.btn` + `--primary`, `--secondary`/`--ghost`, `--accent`, `--danger`, `--danger-quiet`, `--quiet`, `--icon`, `--icon-xs`, `--sm`, `--block` |
| Cards | `.card`, `.card__header`, `.stat-card` |
| Badges / chips | `.badge` + `--success`/`--warning`/`--danger`/`--info`/`--purple`/`--neutral`/`--solid`, `.chip`, `.chip-list` |
| Forms | `.field`, `.input`, `.select`, `.textarea`, `.checkbox`, `.radio`, `.input-group`, `.switch-row` |
| Form errors | `[aria-invalid="true"]` (or `.input--error`) + `.field.is-invalid .field__error` |
| Tables | `.table`, `.table--compact`, `.table-scroll` (focusable scroll region), `.th-sort` (with `aria-sort`), `.table-toolbar`, `.table-footer`, `.pagination` |
| Tabs / nav | `.tabs`, `.tab`, `.nav`, `.nav__link`, `.nav__link__label`, `.nav__badge`, `.nav__group-title`, `.breadcrumb` |
| App shell | `.topbar` + `__menu`/`__heading`/`__title`/`__subtitle`/`__actions`/`__icon-btn`/`__badge`/`__user`, `.sidebar` + `__brand`/`__brand-link`/`__logo`/`__title`/`__nav`/`__close`/`__footer`/`__profile` |
| Layout | `.app`, `.shell`, `.app__main`, `.content`, `.stack` (`--sm`/`--lg`), `.grid` + `-2`/`-3`/`-4`/`-auto`, `.dashboard-split` (`--even`) |
| Global search | `.search` + `__icon`/`__input`/`__clear`/`__panel`/`__results`/`__option`/`__option-text`/`__option-name`/`__option-meta`/`__empty`/`__foot`/`__more-link` |
| Feedback | `.avatar`, `.progress`, `.meter-row`, `.donut` (`--segments`), `.bar-chart`, `.line-chart`, `.legend`, `.alert`, `.toast`, `.empty-state`, `.placeholder-note`, `.skeleton` |
| Dashboard | `.banner` + `__inner`/`__mark`/`__text`/`__eyebrow`/`__title`/`__lead`/`__facts`/`__fact`/`__actions`, `.kpi-grid`, `.donut-split`, `.timeline--activity`, `.activity` + `__icon`/`__body`/`__title`/`__detail`/`__when`, `.exam-row` + `__subject`/`__class`/`__when`, `.list-row` + `__main`/`__title`/`__meta` |
| Overlays | `.modal`, `.drawer` (`--left` / `--right`), `.drawer__header`/`__body`/`__footer`, `.backdrop` / `.drawer__scrim` |

The navigation sidebar is a real `.drawer--left` instance: it re-skins the
drawer primitive with the navy gradient and its own width.

The topbar is the small-screen baseline and **wraps**: below 1024px the search
box drops to its own full-width row (`order: 10`) and the user block collapses
to just the avatar; at ≥1024px the search returns to the first row
(`order: 0`) and the name and role appear next to the avatar.

Layout is **mobile-first**: `style.css` is the small-screen baseline and
`responsive.css` adds the tablet (≥768px) and desktop (≥1024px) layers. The
sidebar is an off-canvas drawer on phones, a persistent icon rail on tablets and
a `position: fixed` column on desktop — see
[Responsive behaviour](#responsive-behaviour).

Accessibility: CSS reset, skip link, landmark elements, labelled form controls,
`aria-current` navigation state, `aria-sort` on sortable columns, `aria-live`
regions for status messages, one consistent `:focus-visible` ring,
keyboard-operable dialogs and drawer with a focus trap that returns focus to the
trigger on close, and `prefers-reduced-motion` support.

---

## Page status

| Page | Status |
| --- | --- |
| Dashboard | **Complete** — see below |
| Students | **Complete** — register, profile panel, and working Add / Edit / Delete (see below) |
| Attendance | Working (class/section/date register with mark + save) |
| Teachers | Shell + live "at a glance" facts; full directory added in its own step. Acknowledges a `?search=` deep link from the topbar |
| Classes, Assignments, Exams, Fees, Announcements | Shell + live "at a glance" facts; full module added in its own step |
| Settings | Working (school profile, session facts, working preferences, self-check button) |

All ten pages share the injected shell: sidebar, global search, notification
badge, Administrator avatar and footer.

---

## The dashboard (`index.html` / `js/dashboard.js`)

`index.html` holds the **static structure and wording** — including the
`Welcome to Mother's Lap School System` `<h1>`, which is the page's only `h1`.
JavaScript fills the figures into placeholders; it does not assemble the copy.
The separate "recent admissions" card was dropped in favour of admissions
appearing inside Recent Activities, where they are one event among many.

Nine render functions run off a single `app:ready` event:
`renderBanner`, `renderKpis`, `renderStrength`, `renderTrend`, `renderFees`,
`renderGender`, `renderActivities`, `renderAnnouncements`, `renderExams`.

| Section | What it shows | Source |
| --- | --- | --- |
| Welcome banner | School, city, level, medium and timings; the four headline numbers | `school`, `session`, `totals` |
| Six KPI cards | 2,000 students · 50 teachers · 13 classes / 52 sections · today's attendance % · fees collected this month (PKR) · pending fees (PKR) | `totals`, `getAttendanceToday()`, `getMonthlyFeeSummary()` |
| Class strength | One bar per class (13 bars) | `getClassSummary()` |
| 7-day attendance | Line chart plus a 7-row breakdown table | `getAttendanceTrend(7)` |
| Fee overview | Collected vs pending donut, month bill, weakest classes as meters | `getMonthlyFeeSummary()`, `getFeeSummary()` |
| Gender | Donut plus a per-stage split | `getGenderSummary()` |
| Recent activities | ≥6-item dated timeline mixing five record types | `getRecentActivity(8)` |
| Latest announcements | 5 notices, `Important` badge, pinned notice kept | `getAnnouncements()` |
| Upcoming exams | Subject, class, date and time per **sitting** | `getExamPapers()` |

### The six KPI cards

Six figures in one row is a lot of money and numbers to lay out at 360px, so
`.kpi-grid` steps deliberately:

| Width | Columns |
| --- | --- |
| <= 360px | 1 |
| 361–479px | 2 |
| 480–1023px | 2 |
| >= 1024px | 3 |

The three-column step lives in the `>= 1024px` block, **not** at `>= 768px`.
The tablet rail (768–1023px) leaves only ~692px of content width, so three
columns would be ~215px each — too narrow for a figure like `Rs 15,287,200`.
Declaring `repeat(3)` at `>= 768px` would also have been silently dead for the
entire tablet range, since the tablet block overrides it later in source order.

### Nothing is typed in

Every figure on the dashboard comes from `SchoolData`. `js/dashboard.js`
contains no dataset number at all — the only multi-digit literals left in it are
chart scale constants (the `max: 100` percentage axis, and the `100`/`1000`
percent and one-decimal factors). Donut colours are declared in a `COLOURS` map
in the page script as **token strings**, so `data.js` stays colour-free and the
charts follow the theme.

### Lazy exam schedule

A session's sitting schedule is **672 papers**, of which **360** are still ahead
of today, crossing into **30 sittings**. Rendering all of them up front would be
the dashboard's one genuinely expensive act, so the card previews the next 7
sittings, states `360 papers in all`, and builds the full row-by-row schedule on
the first `<details>` toggle.

The preview is grouped by **sitting**, not by paper. That distinction matters: an
exam runs every subject for every class it covers, so the first *seven papers*
are all "English, 20 Dec, 08:30" and differ only in the class name — seven rows
that say the same thing. Grouped by sitting, each row is a distinct event
carrying all four required facts:

```
English            Playgroup to Grade 10 (13)   20 Dec 2026  08:30
Urdu               Playgroup to Grade 10 (13)   20 Dec 2026  10:30
Sindhi             Playgroup to Grade 10 (13)   20 Dec 2026  12:30
Mathematics        Playgroup to Grade 10 (13)   21 Dec 2026  08:30
Computer Science   Playgroup to Grade 10 (13)   21 Dec 2026  10:30
```

The full class list stays on the row's `title`, so the abbreviated
"Playgroup to Grade 10" never hides which classes are actually sitting.

---

## The student register (`pages/students.html` / `js/students.js`)

All 2,000 records live in memory as plain objects; **only the current page ever
reaches the DOM** (21 `<tr>` for 2,000 students, empty-state row included).
Filtering and sorting run over the array and re-render one page, so every
control composes: search + five filters + sort + page, all at once.

### Columns

| Column | Key | Notes |
| --- | --- | --- |
| Student | `name` | Avatar initials (gender-tinted) + name + gender/age. The initials are a scanning aid, not information in their own right, so they get no column and are `aria-hidden` — the name beside them is the real label |
| GR no | `grNo` | `GR-2026-0145`, tabular |
| Class | `className` | Sorts by **school order**, not alphabetically |
| Section | `sectionName` | A–D; the option list follows the chosen class |
| Roll no | `rollNo` | Sorts **numerically** |
| Guardian / contact | `guardian` | Relation + phone. Not required by the brief but the column the page has always carried; it is one of the searchable fields |
| Attendance | `attendance` | Mini bar **+** exact percentage |
| Fee status | `feeStatus` | Badge + balance due. Sorts by balance, not by label |
| Status | `status` | Badge |
| Actions | — | Not a record field: `sortable: false` and excluded from the CSV. Three buttons — **Profile** (text, labelled), **Edit** and **Delete** (icon-xs, with `title` for pointer users), each carrying an `aria-label` that names the student |

Two sorting details are load-bearing. Class order comes from `CLASS_ORDER`
(built from `Data.classes[].order`) because plain alphabetical puts **"Grade 10"
before "Grade 2"** — the same trap `getExamPapers()` avoids. Roll numbers go
through `Number()` because `localeCompare` would sort `"10"` between `"1"` and
`"2"`.

### The attendance cell

```
[▓▓▓▓▓▓▓▓▓▓▓░░░░]  90.6%
```

A bare percentage makes 89.4% and 89.6% hard to compare at a glance, so the bar
carries the shape and the number carries the precision. The bar is
`aria-hidden="true"` and tone-coded by `attendanceTone()` (≥90 success, ≥85
warning, else danger), so a screen reader hears "90.6%" once rather than twice
and nobody has to infer status from colour alone.

`.progress--mini` (5px, against `.progress`'s 8px) deliberately carries **no
`min-width` floor**. Any floor is a magic number that can only fight the
project's central responsive rule — the table scrolls horizontally, the page
never does — so the bar is free to shrink to nothing inside its declared 124px
column while the fixed-width `.cell-bar__value` (38px) keeps the figures
aligned.

### The profile panel

Clicking a row — or its **Profile** button, which stops propagation so the
click is handled once — opens `App.panel()` with four sections: **Personal
information**, **Guardian information**, **Attendance summary** and **Fee
status**. A panel rather than a centred modal, because the register stays
visible behind it.

The attendance summary places the student **in their own section** ("17 of 38 in
Playgroup - D • section average 91.2%"), because a percentage on its own says
nothing about whether it is normal for the class. The rank is computed as
*students strictly above + 1* rather than by `indexOf` on the sorted roster,
because `indexOf` returns the **first** of any tied positions and would report
the best rank of a group of equals.

The panel footer offers **Close**, **Delete** and **Edit details**. The old
**Mark fee paid** button is gone: it was a demo shortcut that toasted without
writing, and leaving it in the footer would read as a working feature that the
page does not have. Fee status is now genuinely editable — open **Edit
details** and set it on the form.

### Add / Edit / Delete

Three real writes, no page reload:

| Action | Where | What it does |
| --- | --- | --- |
| **Add student** | Page toolbar | Opens the form modal, empty, defaulted to the first class/section |
| **Edit** | Row actions, or **Edit details** in the panel | Opens the *same* modal, pre-filled from the record |
| **Delete** | Row actions, or **Delete** in the panel | `App.confirm` dialog that names the student, then `helpers.removeStudent()` |

After a write, `refreshRegister()` re-runs `renderSummary()` and
`table.refresh(Data.students)`, which re-applies the *existing* filter, search,
sort and page. That is what "stays consistent with the active filters" has to
mean in practice: a record saved into a class you are filtered out of is
correctly **not** rendered, and the toast says so rather than pretending the row
appeared:

> Added Zainab Khan • Grade 5 - A • roll 41
> — saved, but not shown: it does not match the active filters

#### Validation

| Rule | Message shape |
| --- | --- |
| Required | `Student name is required` |
| Letters only | `/^[\p{L}][\p{L} .'-]*$/u` — "…may contain letters only — spaces, hyphens and apostrophes are fine" |
| Min length | 3 characters |
| Phone | `/^03\d{2}-\d{7}$/` → `0300-1234567` |
| Roll number | Integer, unique **within the chosen section** |
| Capacity | Advisory only — the figure in the hint updates, but nothing blocks |

Two of these deserve a note.

**"Letters only" is not "no spaces".** The naive reading of the brief rejects
`Zainab Khan`, which is most of the names in the dataset. The rule therefore
requires a leading letter and then allows letters, spaces, hyphens, apostrophes
and full stops — enough for `Maryam-Noor`, `O'Brien` and `A. S. Khan`, and the
`\p{L}` class (with the `u` flag) means it holds for non-Latin scripts too
rather than silently passing everything through.

**Roll numbers are unique per section, not per school.** `nextRollNo()` reads
the highest roll in the target section and adds one, so the form can suggest a
free number, and `isRollNoTaken()` checks only that section. Every seeded
section is at or near capacity, so capacity is shown as guidance rather than
enforced as a rule — blocking on it would make the form unusable.

Submit stays disabled while the form is invalid, which means the reader cannot
click their way past the errors. So the form also carries a `.sr-only`
`type="submit"` button: **Enter** always fires the form's submit handler, which
reveals every message at once and moves focus to the first bad field. That is
the only route from "disabled" to "here is what is wrong" — worth keeping when
touching `App.formModal`.

#### Nothing is persisted

These writes mutate `Data.students` in memory only. **A page reload regenerates
the seeded 2,000 records and the added, edited or deleted student is gone.**
That is stated in the delete confirmation rather than left for the reader to
discover:

> The record leaves the register and the section roll. This prototype keeps
> nothing in a database, so a page reload brings the record back.

`localStorage` is used for two things only — `mls.settings` and the
`mls.attendance.<date>.<sectionId>` overrides — never for the register.

#### Dialog behaviour

Both overlays share one set of rules, defined once for modal, panel and drawer:

* **Focus moves in.** `App.modal` captures the focused element *before* moving
  focus, so closing can put it back.
* **Focus stays in.** One Tab handler resolves the open overlays in stacking
  order (`#app-modal` → `#app-panel` → `#app-sidebar`) and wraps Tab at both
  ends. A modal can be raised from inside the panel, so the panel must not be
  allowed to steal the Tab.
* **Escape closes one layer** — the topmost. Escape on a delete confirmation
  raised from inside the profile panel must not also throw the panel away,
  because that loses the record the reader was working on.
* **Clicking the overlay closes it**; clicking inside the dialog does not.
* **Focus returns** to the element that opened the overlay. If the table
  re-rendered that button away (a delete removes its own row), `closeModal` and
  `closePanel` fall back to `#main-content` — the same landmark the skip link
  targets — rather than leaving focus on a detached node.

Programmatic-only controls are excluded from the trap's Tab order:
`disabled`, `hidden` and `tabindex="-1"`. The last of those matters here,
because the visually-hidden Enter-submit button would otherwise sit in the tab
order as a button nobody can see.

### Pagination and search

20 rows per page by default, with **10 / 20 / 50** offered; the counter reads
`Showing 1–20 of 2,000 records`, and appends `(filtered from 2,000)` whenever a
filter or search is active so the reader can see what they are looking *at* as
well as what survived. Search covers name, GR number, guardian and phone, which
is whichever the parent happens to have on file at the school office.

`?class=` and `?search=` deep links still work and compose.

---

## Notes on the generated data

* Names, guardians, addresses, phone numbers and e-mail addresses are invented.
* Every school, staff and student name is fictional — no real person is depicted.
* Because 2,000 students are served by 50 teachers, each teacher covers roughly
  7–10 sections (one or two subjects per section). This is arithmetically
  consistent with the specified dataset and is validated by the self-check.