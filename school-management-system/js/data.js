/*!
 * js/data.js
 * ---------------------------------------------------------------------------
 * "Mother's Lap School System" — central demo data layer (SINGLE SOURCE OF TRUTH)
 *
 * Everything the prototype renders comes from this file. No page invents data.
 * All records are fictional demo data: names are realistic Pakistani/Sindhi
 * names but belong to no real person, phone numbers and e-mail addresses are
 * fake and use reserved/example patterns.
 *
 * Dataset (fixed by the school data specification):
 *   - 2,000 students across 13 classes (Playgroup -> Grade 10) x sections A-D
 *   - 50 teachers, every section has a class teacher, no double booking
 *   - 15 subjects; Physics / Chemistry / Biology / Pakistan Studies only in G6-G10
 *   - Fees in PKR, school year runs April -> March
 *
 * DETERMINISM: all random values come from a seeded PRNG, so the dataset is
 * byte-for-byte identical on every page load and in every browser.
 *
 * Exposes: window.SchoolData
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  /* =========================================================================
   * 1. SEEDED PSEUDO-RANDOM NUMBER GENERATOR
   * ====================================================================== */

  const SEED = 20260401;

  /** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(SEED);

  /** Integer in [min, max] (inclusive). */
  function randInt(min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  /** Float in [min, max) rounded to `decimals`. */
  function randFloat(min, max, decimals) {
    const value = rng() * (max - min) + min;
    const factor = Math.pow(10, decimals || 0);
    return Math.round(value * factor) / factor;
  }

  /** One random item of an array. */
  function pick(list) {
    return list[Math.floor(rng() * list.length)];
  }

  /** Fisher-Yates shuffle (returns a new array). */
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /**
   * Weighted random pick.
   * @param {Array<[*, number]>} entries value/weight pairs
   */
  function weightedPick(entries) {
    const total = entries.reduce(function (sum, entry) { return sum + entry[1]; }, 0);
    let roll = rng() * total;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i][1];
      if (roll <= 0) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  }

  /** Stable string hash — used to derive repeatable attendance from ids. */
  function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /** Deterministic PRNG bound to a string (e.g. a student id + a date). */
  function rngFrom(key) {
    return mulberry32(hashString(String(key)));
  }

  /** Zero-pad a number: pad(7, 3) -> "007" */
  function pad(value, length) {
    return String(value).padStart(length, '0');
  }

  /* =========================================================================
   * 2. SMALL DATE / FORMAT HELPERS (school year runs April -> March)
   * ====================================================================== */

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const NOW = new Date();

  /**
   * Academic session: April -> March.
   * April-December => the session started this calendar year,
   * January-March   => the session started last calendar year.
   */
  const SESSION_START_YEAR = NOW.getMonth() >= 3 ? NOW.getFullYear() : NOW.getFullYear() - 1;

  const ACADEMIC_SESSION = {
    label: SESSION_START_YEAR + '-' + (SESSION_START_YEAR + 1),
    startDate: SESSION_START_YEAR + '-04-01',
    endDate: (SESSION_START_YEAR + 1) + '-03-31',
    startYear: SESSION_START_YEAR,
    endYear: SESSION_START_YEAR + 1,
    currentMonthIndex: ((NOW.getMonth() - 3) + 12) % 12, // 0 = April
    /** How far we are through the session, 0 -> 1. */
    progress: (function () {
      const start = new Date(SESSION_START_YEAR, 3, 1).getTime();
      const end = new Date(SESSION_START_YEAR + 1, 2, 31).getTime();
      return Math.min(1, Math.max(0, (NOW.getTime() - start) / (end - start)));
    })()
  };

  /** "YYYY-MM-DD" (the storage format used across the demo data). */
  function isoDate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1, 2) + '-' + pad(date.getDate(), 2);
  }

  /** Shifts a "YYYY-MM-DD" string forwards (or back, for negatives) by n days. */
  function addDaysIso(isoDay, days) {
    const parts = String(isoDay).split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + Number(days || 0));
    return isoDate(date);
  }

  /** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
  function daysBetween(fromIso, toIso) {
    const a = String(fromIso).split('-');
    const b = String(toIso).split('-');
    const from = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
    const to = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  /** Random day inside a month window; never in the future. */
  function randomDateIn(startYear, endYear, fromMonth, toMonth) {
    const start = new Date(startYear, fromMonth, 1);
    const end = new Date(endYear, toMonth, 28);
    const span = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
    const day = new Date(start.getTime() + Math.floor(rng() * span) * 86400000);
    return day > NOW ? new Date(NOW.getTime()) : day;
  }

  /* =========================================================================
   * 3. SCHOOL PROFILE
   * ====================================================================== */

  const SCHOOL = {
    name: "Mother's Lap School System",
    shortName: "Mother's Lap",
    tagline: 'Nurturing young minds since 1998',
    about: 'A co-educational primary and secondary school in Hyderabad, Sindh, '
      + 'combining academic rigour with the warmth of a mother\'s care.',
    level: 'Playgroup to Grade 10',
    medium: 'English / Urdu / Sindhi',
    board: 'Sindh Board of Intermediate & Secondary Education (primary section)',
    established: 1998,
    session: ACADEMIC_SESSION.label,
    sessionStart: ACADEMIC_SESSION.startDate,
    sessionEnd: ACADEMIC_SESSION.endDate,
    currency: 'PKR',
    currencySymbol: 'Rs',
    address: 'Main Campus, Qasim Nagar, Auto Bhan Road, Hyderabad, Sindh 71000',
    addressShort: 'Qasim Nagar, Hyderabad, Sindh',
    phone: '0377-1029384',
    altPhone: '0377-1029385',
    email: 'info@motherslapschool.edu.pk',
    website: 'www.motherslapschool.edu.pk',
    principal: 'Dr. Farhat Sattar',
    vicePrincipal: 'Mrs. Saima Bano',
    timings: 'Monday to Saturday, 08:00 - 13:30 (Friday break 11:30 - 12:30)',
    // Fictional demo totals — used by the dashboard headline figures.
    totals: { students: 2000, teachers: 50, classes: 13, sections: 52, subjects: 15 }
  };

  /* =========================================================================
   * 4. CLASSES (13) AND SECTIONS (4 per class = 52)
   * ====================================================================== */

  /** classId, display name, short code, stage, typical age, subjects. */
  const CLASS_DEFINITIONS = [
    { id: 'CLS-PLAYGROUP', name: 'Playgroup', code: 'PG', stage: 'Pre-Primary', age: 4, ageLabel: '3 - 4 yrs' },
    { id: 'CLS-NURSERY', name: 'Nursery', code: 'NS', stage: 'Pre-Primary', age: 5, ageLabel: '4 - 5 yrs' },
    { id: 'CLS-PREP', name: 'Prep', code: 'PR', stage: 'Pre-Primary', age: 6, ageLabel: '5 - 6 yrs' },
    { id: 'CLS-G1', name: 'Grade 1', code: 'G1', stage: 'Primary', age: 7, ageLabel: '6 - 7 yrs' },
    { id: 'CLS-G2', name: 'Grade 2', code: 'G2', stage: 'Primary', age: 8, ageLabel: '7 - 8 yrs' },
    { id: 'CLS-G3', name: 'Grade 3', code: 'G3', stage: 'Primary', age: 9, ageLabel: '8 - 9 yrs' },
    { id: 'CLS-G4', name: 'Grade 4', code: 'G4', stage: 'Primary', age: 10, ageLabel: '9 - 10 yrs' },
    { id: 'CLS-G5', name: 'Grade 5', code: 'G5', stage: 'Primary', age: 11, ageLabel: '10 - 11 yrs' },
    { id: 'CLS-G6', name: 'Grade 6', code: 'G6', stage: 'Middle', age: 12, ageLabel: '11 - 12 yrs' },
    { id: 'CLS-G7', name: 'Grade 7', code: 'G7', stage: 'Middle', age: 13, ageLabel: '12 - 13 yrs' },
    { id: 'CLS-G8', name: 'Grade 8', code: 'G8', stage: 'Middle', age: 14, ageLabel: '13 - 14 yrs' },
    { id: 'CLS-G9', name: 'Grade 9', code: 'G9', stage: 'Secondary', age: 15, ageLabel: '14 - 15 yrs' },
    { id: 'CLS-G10', name: 'Grade 10', code: 'G10', stage: 'Secondary', age: 16, ageLabel: '15 - 16 yrs' }
  ];

  const SECTION_LETTERS = ['A', 'B', 'C', 'D'];

  /** Flat class objects (sections are attached later). */
  const CLASSES = CLASS_DEFINITIONS.map(function (def, index) {
    return {
      id: def.id,
      name: def.name,
      code: def.code,
      order: index + 1,
      stage: def.stage,
      age: def.age,
      ageLabel: def.ageLabel,
      sectionLetters: SECTION_LETTERS.slice(),
      sections: [],          // filled below
      sectionIds: [],
      subjects: []           // filled after CURRICULUM is defined
    };
  });

  /** Display name -> class, for the places that need class order or metadata. */
  const CLASS_BY_NAME = {};
  CLASSES.forEach(function (klass) { CLASS_BY_NAME[klass.name] = klass; });

  /* =========================================================================
   * 5. SUBJECTS (15) AND CURRICULUM PER CLASS
   *    Physics / Chemistry / Biology / Pakistan Studies: Grades 6 to 10 only.
   * ====================================================================== */

  const SUBJECT_DEFINITIONS = [
    { id: 'SUB-ENG', name: 'English', code: 'ENG', group: 'Languages' },
    { id: 'SUB-URD', name: 'Urdu', code: 'URD', group: 'Languages' },
    { id: 'SUB-SND', name: 'Sindhi', code: 'SND', group: 'Languages' },
    { id: 'SUB-MAT', name: 'Mathematics', code: 'MAT', group: 'Numeracy' },
    { id: 'SUB-CS', name: 'Computer Science', code: 'CS', group: 'Numeracy' },
    { id: 'SUB-GK', name: 'General Knowledge', code: 'GK', group: 'General' },
    { id: 'SUB-ISC', name: 'Islamiyat', code: 'ISC', group: 'Social' },
    { id: 'SUB-SST', name: 'Social Studies', code: 'SST', group: 'Social' },
    { id: 'SUB-PKS', name: 'Pakistan Studies', code: 'PKS', group: 'Social', seniorOnly: true },
    { id: 'SUB-SCI', name: 'Science', code: 'SCI', group: 'Science' },
    { id: 'SUB-PHY', name: 'Physics', code: 'PHY', group: 'Science', seniorOnly: true },
    { id: 'SUB-CHM', name: 'Chemistry', code: 'CHM', group: 'Science', seniorOnly: true },
    { id: 'SUB-BIO', name: 'Biology', code: 'BIO', group: 'Science', seniorOnly: true },
    { id: 'SUB-ART', name: 'Drawing/Art', code: 'ART', group: 'Co-curricular' },
    { id: 'SUB-PED', name: 'Physical Education', code: 'PED', group: 'Co-curricular' }
  ];

  const SUBJECTS = SUBJECT_DEFINITIONS.map(function (def) {
    return {
      id: def.id,
      name: def.name,
      code: def.code,
      group: def.group,
      seniorOnly: Boolean(def.seniorOnly),
      seniorSubject: Boolean(def.seniorOnly)
    };
  });

  const SUBJECT_NAMES = SUBJECTS.map(function (subject) { return subject.name; });

  const CURRICULUM = {
    'Playgroup': ['English', 'Urdu', 'Islamiyat', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Nursery': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Islamiyat', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Prep': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Islamiyat', 'Social Studies', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 1': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Islamiyat', 'Social Studies', 'Computer Science', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 2': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Islamiyat', 'Social Studies', 'Computer Science', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 3': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Science', 'Islamiyat', 'Social Studies', 'Computer Science', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 4': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Science', 'Islamiyat', 'Social Studies', 'Computer Science', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 5': ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Science', 'Islamiyat', 'Social Studies', 'Computer Science', 'General Knowledge', 'Drawing/Art', 'Physical Education'],
    'Grade 6': SUBJECT_NAMES.slice(),
    'Grade 7': SUBJECT_NAMES.slice(),
    'Grade 8': SUBJECT_NAMES.slice(),
    'Grade 9': SUBJECT_NAMES.slice(),
    'Grade 10': SUBJECT_NAMES.slice()
  };

  CLASSES.forEach(function (klass) {
    klass.subjects = CURRICULUM[klass.name].slice();
    klass.subjectCount = klass.subjects.length;
  });

  /* =========================================================================
   * 6. SECTIONS + SECTION SIZE ALLOCATION (52 sections summing to exactly 2000)
   * ====================================================================== */

  const TOTAL_STUDENTS = 2000;
  const MIN_SECTION_SIZE = 30;
  const MAX_SECTION_SIZE = 40;

  /** 52 sections in class order. */
  const SECTIONS = [];
  CLASSES.forEach(function (klass) {
    klass.sectionLetters.forEach(function (letter) {
      SECTIONS.push({
        id: klass.code + '-' + letter,
        className: klass.name,
        classId: klass.id,
        sectionName: letter,
        name: klass.name + ' - ' + letter,
        label: klass.name + ' ' + letter,
        capacity: MAX_SECTION_SIZE,
        subjects: klass.subjects.slice(),
        classTeacherId: null,
        classTeacherName: '—',
        roster: [],   // teacherId -> subjects
        students: 0,
        boys: 0,
        girls: 0
      });
    });
  });

  /**
   * Distribute 2000 students across 52 sections, each between 30 and 40.
   * Random weights keep the numbers natural; a balancing pass then nudges the
   * total to exactly 2000 while respecting the 30-40 rule.
   */
  (function allocateSectionSizes() {
    // Tight spread around the 38.5 mean keeps sizes natural (no mass clamping).
    const weights = SECTIONS.map(function () { return randFloat(0.95, 1.05, 4); });
    const weightTotal = weights.reduce(function (a, b) { return a + b; }, 0);

    let assigned = 0;
    weights.forEach(function (weight, index) {
      const raw = (weight / weightTotal) * TOTAL_STUDENTS;
      const size = Math.min(MAX_SECTION_SIZE, Math.max(MIN_SECTION_SIZE, Math.round(raw)));
      SECTIONS[index].capacity = size;
      assigned += size;
    });

    // Balancing pass: nudge sections by +/-1 until the total matches exactly.
    let guard = 0;
    while (assigned !== TOTAL_STUDENTS && guard < 10000) {
      const diff = TOTAL_STUDENTS - assigned;
      const step = diff > 0 ? 1 : -1;
      // Walk sections in a shuffled order so the adjustment spreads out.
      const order = shuffle(SECTIONS.map(function (section, index) { return index; }));
      for (let i = 0; i < order.length; i++) {
        const section = SECTIONS[order[i]];
        if (step > 0 && section.capacity < MAX_SECTION_SIZE) { section.capacity++; assigned++; }
        else if (step < 0 && section.capacity > MIN_SECTION_SIZE) { section.capacity--; assigned--; }
        if (assigned === TOTAL_STUDENTS) break;
      }
      guard++;
    }
    SECTIONS.forEach(function (section) { section.students = section.capacity; });
  })();

  /* =========================================================================
   * 7. NAME / ADDRESS POOLS (fictional but realistic Sindhi-Pakistani names)
   * ====================================================================== */

  const MALE_NAMES = [
    'Ahmed', 'Ali', 'Aamir', 'Anwar', 'Arif', 'Asad', 'Asif', 'Atif', 'Awais', 'Babar',
    'Badal', 'Bilal', 'Danish', 'Danesh', 'Dilawar', 'Ejaz', 'Faisal', 'Farooq', 'Feroz', 'Ghulam',
    'Habib', 'Hafeez', 'Hamza', 'Haroon', 'Hasnain', 'Hassan', 'Hussain', 'Ibrahim', 'Iftikhar', 'Ikram',
    'Imran', 'Imtiaz', 'Irfan', 'Ishtiaq', 'Jameel', 'Javed', 'Junaid', 'Kamran', 'Kashif', 'Khalid',
    'Khizer', 'Liaqat', 'Luqman', 'Maqsood', 'Mohsin', 'Moiz', 'Muhammad', 'Mukesh', 'Mumtaz', 'Murtaza',
    'Nadeem', 'Naseer', 'Noman', 'Omer', 'Owais', 'Pervez', 'Qais', 'Raees', 'Rahmat', 'Raza',
    'Riaz', 'Rizwan', 'Saeed', 'Salman', 'Sami', 'Shahid', 'Shakeel', 'Shoaib', 'Sohail', 'Subhan',
    'Tanveer', 'Tariq', 'Tayyab', 'Umair', 'Usman', 'Wajid', 'Waseem', 'Yasin', 'Younis', 'Yousuf',
    'Zafar', 'Zeeshan', 'Zulfiqar', 'Adeel', 'Aqeel', 'Nabeel', 'Rehan'
  ];

  const FEMALE_NAMES = [
    'Ayesha', 'Fatima', 'Zainab', 'Maryam', 'Hina', 'Sadia', 'Rabia', 'Kiran', 'Nida', 'Saima',
    'Anum', 'Bushra', 'Farhana', 'Ghazala', 'Iqra', 'Javeria', 'Kanwal', 'Laila', 'Madiha', 'Nadia',
    'Nazia', 'Saba', 'Sania', 'Tehmina', 'Uzma', 'Wajiha', 'Yusra', 'Zeba', 'Amna', 'Asma',
    'Barira', 'Chandni', 'Dilnaz', 'Erum', 'Farah', 'Gulshan', 'Hajra', 'Imaan', 'Komal', 'Laiba',
    'Mehwish', 'Nimra', 'Palwasha', 'Quratulain', 'Raheela', 'Sameera', 'Taskeen', 'Veena', 'Wagma', 'Abida',
    'Armeena', 'Bhanwari', 'Deepa', 'Falak', 'Mahira', 'Nighat', 'Reena', 'Shazia', 'Sumbul', 'Zahra',
    'Hafsa', 'Insia', 'Javeria', 'Noor', 'Rukhsana', 'Saira', 'Sunita', 'Wasima', 'Areeba', 'Humaira'
  ];

  const SURNAMES = [
    'Khan', 'Sheikh', 'Bhatti', 'Qureshi', 'Siddiqui', 'Malik', 'Awan', 'Butt', 'Channa', 'Durrani',
    'Farooqi', 'Hashmi', 'Hussaini', 'Baloch', 'Bukhari', 'Baig', 'Abbasi', 'Ansari', 'Memon', 'Kazi',
    'Bhatia', 'Junejo', 'Samoo', 'Sehbai', 'Solangi', 'Soomro', 'Bishr', 'Sial', 'Khaskheli', 'Khuhro',
    'Khoso', 'Mangi', 'Rind', 'Siyal', 'Jamali', 'Khokhar', 'Bana', 'Ghauri', 'Yousafzai', 'Ghani',
    'Rehman', 'Zaman', 'Mahar', 'Panhwar', 'Sattar', 'Bhurgri', 'Kachro', 'Mureed'
  ];

  const RELATIONS = [['Father', 46], ['Mother', 40], ['Guardian', 9], ['Uncle', 3], ['Aunt', 2]];

  const AREAS = [
    'Latifabad Unit 7', 'Latifabad Unit 8', 'Latifabad Unit 9', 'Latifabad Unit 10',
    'Latifabad Unit 11', 'Latifabad Unit 12', 'Qasim Nagar', 'Hirabad', 'Hussainabad',
    'Saddar Town', 'Auto Bhan Road', 'Tando Jam', 'Bypass Phase 1', 'Bypass Phase 2',
    'Citizen Colony', 'Allah Rakhi', 'Gulshan-e-Iqbal', 'Jamshoro Township', 'Kotri',
    'Tando Allah Khan', 'Hala Naka', 'Bhit Shah', 'Gulistan-e-Jauhar'
  ];

  /** Fake mobile number in local format 03XX-XXXXXXX. */
  function fakePhone() {
    const prefix = pick(['00', '01', '03', '11', '15', '22', '23', '30', '31', '33', '34', '35', '36', '42', '45']);
    let digits = '';
    for (let i = 0; i < 7; i++) digits += randInt(0, 9);
    return '03' + prefix + '-' + digits;
  }

  function fakeAddress() {
    const area = pick(AREAS);
    const house = randInt(1, 240);
    const street = randInt(1, 22);
    const style = randInt(1, 3);
    let line;
    if (style === 1) line = 'House ' + house + ', Street ' + street + ', ' + area;
    else if (style === 2) line = 'Flat ' + randInt(1, 40) + ', Block ' + randInt(1, 9) + ', ' + area;
    else line = 'Plot ' + house + ', ' + area;
    return line + ', Hyderabad, Sindh';
  }

  /** First + last name, retried until the combination is still unused. */
  function uniqueFullName(gender, usedNames) {
    const firstPool = gender === 'Female' ? FEMALE_NAMES : MALE_NAMES;
    for (let attempt = 0; attempt < 60; attempt++) {
      const first = pick(firstPool);
      const last = pick(SURNAMES);
      const full = first + ' ' + last;
      if (!usedNames.has(full)) {
        usedNames.add(full);
        return { firstName: first, lastName: last, name: full };
      }
    }
    // Fallback: add a middle initial to guarantee a unique string.
    const first = pick(firstPool);
    const last = pick(SURNAMES);
    const middle = ' ' + pick(FEMALE_NAMES.concat(MALE_NAMES)).charAt(0) + '.';
    const full = first + middle + ' ' + last;
    usedNames.add(full);
    return { firstName: first, lastName: last, name: full };
  }

  /** Date of birth that matches the age band of the given class. */
  function dateOfBirthForAge(age) {
    const year = NOW.getFullYear() - age;
    const month = randInt(0, 11);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = randInt(1, daysInMonth);
    const dob = new Date(year, month, day);
    return dob > NOW ? new Date(year - 1, month, day) : dob;
  }

  /* =========================================================================
   * 8. TEACHERS (50)
   *    Each teacher owns a main subject plus 1 extra subject, so they can cover
   *    2 subjects per section while staying inside the curriculum of every
   *    class they are assigned to.
   * ====================================================================== */

  const TEACHER_SUBJECT_BLUEPRINT = [
    { subject: 'English', count: 6, partners: ['Urdu', 'Sindhi', 'General Knowledge'] },
    { subject: 'Urdu', count: 6, partners: ['English', 'Sindhi', 'Islamiyat'] },
    { subject: 'Mathematics', count: 6, partners: ['General Knowledge', 'Computer Science'] },
    { subject: 'Islamiyat', count: 3, partners: ['General Knowledge', 'Urdu'] },
    { subject: 'Sindhi', count: 3, partners: ['Urdu', 'General Knowledge'] },
    { subject: 'General Knowledge', count: 3, partners: ['Islamiyat', 'Drawing/Art'] },
    { subject: 'Drawing/Art', count: 3, partners: ['Physical Education', 'General Knowledge'] },
    { subject: 'Physical Education', count: 3, partners: ['Drawing/Art', 'General Knowledge'] },
    { subject: 'Social Studies', count: 3, partners: ['Islamiyat', 'General Knowledge'] },
    { subject: 'Computer Science', count: 3, partners: ['Mathematics', 'General Knowledge'] },
    { subject: 'Science', count: 3, partners: ['Mathematics', 'General Knowledge'] },
    { subject: 'Physics', count: 2, partners: ['Chemistry', 'Mathematics'] },
    { subject: 'Chemistry', count: 2, partners: ['Biology', 'Mathematics'] },
    { subject: 'Biology', count: 2, partners: ['Science', 'General Knowledge'] },
    { subject: 'Pakistan Studies', count: 2, partners: ['Islamiyat', 'Social Studies'] }
  ];

  const QUALIFICATIONS = {
    'Languages': ['M.A. English Literature', 'M.A. Urdu Literature', 'M.A. Sindhi Literature', 'M.Ed. (Languages)', 'B.S. English (Teaching)'],
    'Numeracy': ['M.Sc. Mathematics', 'M.Sc. Computer Science', 'M.Ed. (Maths)', 'B.S. Mathematics & Physics', 'M.S. Information Technology'],
    'Social': ['M.A. Islamiyat', 'M.A. Political Science', 'M.A. Pakistan Studies', 'M.Ed. (Social Sciences)', 'B.S. Sociology'],
    'Science': ['M.Sc. Physics', 'M.Sc. Chemistry', 'M.Sc. Biology', 'M.Sc. Zoology', 'M.S. General Science'],
    'General': ['B.A. General', 'M.A. General Knowledge', 'B.Ed. (General)', 'M.A. Education'],
    'Co-curricular': ['B.F.A. (Fine Arts)', 'M.A. Physical Education', 'Diploma in Art & Craft', 'M.Ed. (Physical Education)']
  };

  const TEACHERS = (function buildTeachers() {
    const usedNames = new Set();
    const usedEmails = new Set();
    const list = [];
    let counter = 0;

    TEACHER_SUBJECT_BLUEPRINT.forEach(function (plan) {
      for (let i = 0; i < plan.count; i++) {
        counter++;
        const gender = weightedPick([['Male', 52], ['Female', 48]]);
        const nameParts = uniqueFullName(gender, usedNames);
        const extraSubject = plan.partners[i % plan.partners.length];
        const mainSubjectDef = SUBJECTS.filter(function (s) { return s.name === plan.subject; })[0];
        const subjectGroup = mainSubjectDef.group;

        let email = (nameParts.firstName + '.' + nameParts.lastName + '@motherslapschool.edu.pk')
          .toLowerCase().replace(/[^a-z0-9.@]/g, '');
        if (usedEmails.has(email)) {
          email = email.replace('@', counter + '@');
        }
        usedEmails.add(email);

        const experience = randInt(2, 24);
        list.push({
          id: 'TCH-' + pad(counter, 3),
          staffId: 'STF-' + pad(counter, 3),
          name: nameParts.name,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          gender: gender,
          mainSubject: plan.subject,
          canTeach: [plan.subject, extraSubject],   // extra skill used by the scheduler
          qualification: pick(QUALIFICATIONS[subjectGroup] || QUALIFICATIONS.General),
          experience: experience,
          designation: experience >= 15 ? 'Senior Teacher'
            : (plan.subject === 'English' && experience >= 12 ? 'Head of Department'
              : (counter === 1 ? 'Controller of Examinations' : 'Teacher')),
          phone: fakePhone(),
          email: email,
          joiningDate: isoDate(new Date(SESSION_START_YEAR - randInt(1, 8), randInt(0, 11), randInt(1, 28))),
          address: fakeAddress(),
          assignedClassSections: [],   // "Grade 3 - B · Mathematics" entries
          sectionCount: 0,
          classTeacherOf: [],          // section ids such as "G3-B"
          subjects: [],                // subjects actually taught
          status: 'Active'
        });
      }
    });

    return list;
  })();

  /* =========================================================================
   * 9. TEACHING ALLOCATION
   *    Rules enforced:
   *      a) every (class, section, subject) triple gets exactly one teacher
   *      b) every teacher only teaches subjects that exist in that class
   *      c) a teacher appears at most once per section (no double booking)
   *      d) each section has exactly one class teacher
   * ====================================================================== */

  /**
   * Load ceiling per teacher. With 52 sections x ~11.6 subjects = 604 teaching
   * slots and only 50 teachers, every teacher covers roughly 9 sections of one
   * or two subjects, so the ceiling is set at 10 to keep the roster realistic
   * (1-2 subjects per section, at most two subjects for the same teacher in
   * the same section, never the same section twice).
   */
  const MAX_SECTIONS_PER_TEACHER = 10;

  /** Classes in which every one of the teacher's skills is on the timetable. */
  function eligibleClassesFor(teacher) {
    return CLASSES.filter(function (klass) {
      return teacher.canTeach.every(function (subject) {
        return klass.subjects.indexOf(subject) !== -1;
      });
    }).map(function (klass) { return klass.name; });
  }

  /**
   * Reorders the subjects of one section so that subjects which the same
   * teacher can both take sit next to each other. Pairing works far better
   * when the scheduler sees the pair consecutively.
   */
  function orderSubjectsForPairing(subjects, className) {
    const pool = subjects.slice();
    const ordered = [];
    while (pool.length) {
      const current = pool.shift();
      ordered.push(current);
      let bestIndex = -1;
      let bestScore = 0;
      pool.forEach(function (candidate, index) {
        // Count teachers able to teach both subjects in this class.
        const shared = TEACHERS.filter(function (teacher) {
          return teacher.canTeach.indexOf(current) !== -1
            && teacher.canTeach.indexOf(candidate) !== -1
            && teacher.eligibleClasses.indexOf(className) !== -1;
        }).length;
        const score = shared - index * 0.001;   // tie-break: keep declared order
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      });
      if (bestIndex >= 0) ordered.push(pool.splice(bestIndex, 1)[0]);
    }
    return ordered;
  }

  const TEACHER_BY_ID = {};
  TEACHERS.forEach(function (teacher) {
    TEACHER_BY_ID[teacher.id] = teacher;
    teacher.eligibleClasses = eligibleClassesFor(teacher);
  });

  (function buildTimetable() {
    const load = {};
    TEACHERS.forEach(function (teacher) { load[teacher.id] = 0; });

    SECTIONS.forEach(function (section) {
      const bucket = [];   // [{ teacherId, subjects: [] }]
      const assignedTeacherFor = {};   // subject -> teacherId

      orderSubjectsForPairing(section.subjects, section.className).forEach(function (subject) {
        if (assignedTeacherFor[subject]) return;

        let best = null;
        let bestScore = Infinity;

        TEACHERS.forEach(function (teacher) {
          if (teacher.canTeach.indexOf(subject) === -1) return;
          if (teacher.eligibleClasses.indexOf(section.className) === -1) return;
          if (load[teacher.id] >= MAX_SECTIONS_PER_TEACHER) return;
          const entry = bucket.filter(function (item) { return item.teacherId === teacher.id; })[0];
          if (entry && entry.subjects.length >= 2) return;   // max 2 subjects per section

          // Prefer: reuse a teacher already in this section, then the lightest
          // workload, then the subject specialist, then the lower teacher id.
          let score = load[teacher.id] * 2;
          score += entry ? 0 : 6;
          score += teacher.mainSubject === subject ? 0 : 1;
          score += parseInt(teacher.id.slice(4), 10) * 0.001;
          if (score < bestScore) { bestScore = score; best = teacher; }
        });

        if (!best) {
          // Repair step (keeps the dataset valid and complete): give the
          // subject to the teacher with the smallest workload.
          const candidates = TEACHERS.filter(function (teacher) {
            return teacher.canTeach.indexOf(subject) === -1
              && teacher.eligibleClasses.indexOf(section.className) !== -1;
          });
          best = candidates.sort(function (a, b) {
            return (load[a.id] - load[b.id])
              || (parseInt(a.id.slice(4), 10) - parseInt(b.id.slice(4), 10));
          })[0];
          if (best) {
            best.canTeach.push(subject);
            best.eligibleClasses = eligibleClassesFor(best);
          }
        }

        if (!best) return;   // should never happen — caught by the self-check

        let entry = bucket.filter(function (item) { return item.teacherId === best.id; })[0];
        if (!entry) {
          entry = { teacherId: best.id, subjects: [] };
          bucket.push(entry);
          load[best.id]++;
        }
        entry.subjects.push(subject);
        assignedTeacherFor[subject] = best.id;
      });

      // Class teacher = the teacher carrying the biggest load in this section.
      const ranked = bucket.slice().sort(function (a, b) {
        return (b.subjects.length - a.subjects.length)
          || (load[a.teacherId] - load[b.teacherId])
          || (parseInt(a.teacherId.slice(4), 10) - parseInt(b.teacherId.slice(4), 10));
      });
      const classTeacherId = ranked.length ? ranked[0].teacherId : null;

      section.roster = bucket;
      section.classTeacherId = classTeacherId;
      section.classTeacherName = classTeacherId ? TEACHER_BY_ID[classTeacherId].name : '—';
    });

    // Roll the allocation back onto the teacher records.
    TEACHERS.forEach(function (teacher) {
      teacher.subjects = teacher.canTeach.slice();
      teacher.sectionCount = 0;
      teacher.assignedClassSections = [];
      teacher.classTeacherOf = [];
    });

    SECTIONS.forEach(function (section) {
      section.roster.forEach(function (entry) {
        const teacher = TEACHER_BY_ID[entry.teacherId];
        teacher.sectionCount++;
        teacher.subjects.forEach(function (subject) {
          if (teacher.assignedClassSections.indexOf(subject) === -1) {
            teacher.assignedClassSections.push(subject);
          }
        });
        entry.subjects.forEach(function (subject) {
          teacher.assignedClassSections.push(section.label + ' · ' + subject);
        });
        if (teacher.classTeacherOf.indexOf(section.id) === -1) {
          teacher.classTeacherOf.push(section.id);
        }
      });
      if (section.classTeacherId) {
        TEACHER_BY_ID[section.classTeacherId].classTeacherOf.push(section.id + ' (class teacher)');
      }
    });
  })();

  /* =========================================================================
   * 10. STUDENTS (exactly 2000)
   * ====================================================================== */

  const FEE_STATUS_WEIGHTS = [['Paid', 68], ['Pending', 17], ['Partial', 7], ['Overdue', 8]];
  const STATUS_WEIGHTS = [['Active', 95], ['On Leave', 3], ['Inactive', 1], ['Left', 1]];

  const STUDENTS = (function buildStudents() {
    const list = [];
    const usedNames = new Set();
    let counter = 0;

    SECTIONS.forEach(function (section) {
      const classDef = CLASSES.filter(function (klass) { return klass.name === section.className; })[0];

      for (let roll = 1; roll <= section.capacity; roll++) {
        counter++;
        const gender = weightedPick([['Male', 51], ['Female', 49]]);
        const nameParts = uniqueFullName(gender, usedNames);
        const guardianRelation = weightedPick(RELATIONS);
        // Guardian first name always matches the stated relation.
        const guardianFirst = guardianRelation === 'Mother' || guardianRelation === 'Aunt'
          ? pick(FEMALE_NAMES) : pick(MALE_NAMES);
        const guardianLast = randInt(1, 20) === 1 ? pick(SURNAMES) : nameParts.lastName;
        const attendance = randFloat(82.5, 100, 1);
        const status = weightedPick(STATUS_WEIGHTS);
        const feeStatus = weightedPick(FEE_STATUS_WEIGHTS);
        const classAge = classDef.age;
        // Admitted between 1 and (age - 4) years ago, so Grade 10 students are
        // not shown as freshly admitted toddlers' classmates.
        const admissionDate = randomDateIn(
          NOW.getFullYear() - Math.max(1, classAge - 4),
          NOW.getFullYear() - 1, 3, NOW.getMonth()
        );

        const student = {
          id: 'STU-' + pad(counter, 4),
          grNo: 'GR-' + SESSION_START_YEAR + '-' + pad(counter, 4),
          name: nameParts.name,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          gender: gender,
          className: section.className,
          classId: classDef.id,
          sectionName: section.sectionName,
          sectionId: section.id,
          rollNo: roll,                       // unique inside the section
          age: classAge + randInt(-1, 1),
          dateOfBirth: isoDate(dateOfBirthForAge(classAge)),
          admissionDate: isoDate(admissionDate),
          guardian: guardianFirst + ' ' + guardianLast,
          guardianRelation: guardianRelation,
          phone: fakePhone(),
          address: fakeAddress(),
          attendance: attendance,
          feeStatus: feeStatus,
          status: status,
          bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-', 'AB-']),
          transport: weightedPick([['Yes', 38], ['No', 62]])
        };
        list.push(student);
      }
    });

    return list;
  })();

  // Indexes for fast lookups.
  /* Id -> record, not id -> array position. A delete splices the array and
     shifts every later record down by one, which would silently invalidate an
     index-based lookup for 2,000 records at once. Keying on the record itself
     keeps getStudentById correct no matter how the array is reordered. */
  const STUDENT_INDEX = {};
  STUDENTS.forEach(function (student) { STUDENT_INDEX[student.id] = student; });

  const STUDENTS_BY_SECTION = {};
  const STUDENTS_BY_CLASS = {};
  SECTIONS.forEach(function (section) { STUDENTS_BY_SECTION[section.id] = []; });
  CLASSES.forEach(function (klass) { STUDENTS_BY_CLASS[klass.name] = []; });
  STUDENTS.forEach(function (student) {
    STUDENTS_BY_SECTION[student.sectionId].push(student);
    STUDENTS_BY_CLASS[student.className].push(student);
  });

  // Sync section head-counts and gender split.
  SECTIONS.forEach(function (section) {
    const roster = STUDENTS_BY_SECTION[section.id];
    section.students = roster.length;
    section.boys = roster.filter(function (student) { return student.gender === 'Male'; }).length;
    section.girls = roster.filter(function (student) { return student.gender === 'Female'; }).length;
  });
  CLASSES.forEach(function (klass) {
    const roster = STUDENTS_BY_CLASS[klass.name];
    klass.studentCount = roster.length;
    klass.boys = roster.filter(function (student) { return student.gender === 'Male'; }).length;
    klass.girls = roster.filter(function (student) { return student.gender === 'Female'; }).length;
    klass.classTeacherIds = klass.sections.map(function (letter) {
      const section = SECTIONS.filter(function (item) {
        return item.className === klass.name && item.sectionName === letter;
      })[0];
      return section ? section.classTeacherId : null;
    });
  });

  /* =========================================================================
   * 11. FEE STRUCTURE (PKR) + FEE LEDGER
   * ====================================================================== */

  const FEE_RULES = [
    // base figures for Playgroup, uplifted gradually by class level
    { monthly: 4500, admission: 12000, registration: 2500, security: 6000, library: 800, transport: 3000, lab: 0 },
    { monthly: 5000, admission: 12000, registration: 2500, security: 6000, library: 800, transport: 3000, lab: 0 },
    { monthly: 5500, admission: 13000, registration: 2800, security: 6500, library: 900, transport: 3200, lab: 0 },
    { monthly: 6000, admission: 14000, registration: 3000, security: 7000, library: 1000, transport: 3400, lab: 0 },
    { monthly: 6500, admission: 15000, registration: 3200, security: 7500, library: 1100, transport: 3600, lab: 0 },
    { monthly: 7000, admission: 16000, registration: 3400, security: 8000, library: 1200, transport: 3800, lab: 500 },
    { monthly: 7500, admission: 17000, registration: 3600, security: 8500, library: 1300, transport: 4000, lab: 700 },
    { monthly: 8000, admission: 18000, registration: 3800, security: 9000, library: 1400, transport: 4200, lab: 900 },
    { monthly: 8500, admission: 19000, registration: 4000, security: 9500, library: 1500, transport: 4400, lab: 1200 },
    { monthly: 9000, admission: 20000, registration: 4200, security: 10000, library: 1600, transport: 4600, lab: 1500 },
    { monthly: 9800, admission: 22000, registration: 4500, security: 10500, library: 1800, transport: 4800, lab: 1800 },
    { monthly: 10500, admission: 24000, registration: 4800, security: 11000, library: 2000, transport: 5000, lab: 2200 },
    { monthly: 11500, admission: 26000, registration: 5200, security: 12000, library: 2200, transport: 5200, lab: 2600 }
  ];

  const FEES = {
    currency: 'PKR',
    currencySymbol: 'Rs',
    frequency: 'Monthly (April to March)',
    lateFinePercent: 2,          // per month on outstanding amount
    discountRules: [
      { id: 'DISC-01', label: 'Sibling discount', value: 10, note: 'Second and third child, 10% on tuition' },
      { id: 'DISC-02', label: 'Full-session prepaid', value: 5, note: '5% off when the full session is paid in advance' },
      { id: 'DISC-03', label: 'Staff / old student', value: 15, note: '15% concession for staff children and old students' }
    ],
    structures: CLASSES.map(function (klass, index) {
      const rule = FEE_RULES[index];
      return {
        classId: klass.id,
        className: klass.name,
        monthlyTuition: rule.monthly,
        admissionFee: rule.admission,
        registrationFee: rule.registration,
        securityDeposit: rule.security,
        libraryFee: rule.library,
        labFee: rule.lab,
        transportFee: rule.transport,
        totalMonthly: rule.monthly + rule.library + rule.lab + rule.transport
      };
    })
  };

  const FEE_STRUCTURE_BY_CLASS = {};
  FEES.structures.forEach(function (entry) { FEE_STRUCTURE_BY_CLASS[entry.className] = entry; });

  /** Amount paid so far for the current session, derived from the fee status.
   *  Shared by the seed pass below and by helpers.addStudent, so a record typed
   *  into the Add Student form carries the same ledger fields as a generated
   *  one instead of arriving with undefined amounts. */
  function applyFeeLedger(student) {
    const structure = FEE_STRUCTURE_BY_CLASS[student.className];
    const monthsElapsed = Math.max(1, ACADEMIC_SESSION.currentMonthIndex + 1);
    const expected = structure.monthlyTuition * monthsElapsed;
    let ratio;
    if (student.feeStatus === 'Paid') ratio = randFloat(1, 1.12, 3);
    else if (student.feeStatus === 'Partial') ratio = randFloat(0.3, 0.85, 3);
    else if (student.feeStatus === 'Overdue') ratio = randFloat(0, 0.6, 3);
    else ratio = randFloat(0.5, 0.9, 3);   // Pending
    student.feeExpected = expected;
    student.feePaid = Math.min(Math.round(expected * ratio), Math.round(expected));
    student.feeBalance = Math.max(0, student.feeExpected - student.feePaid);
    student.feeMonthsElapsed = monthsElapsed;
  }

  (function buildFeeLedger() {
    STUDENTS.forEach(applyFeeLedger);
  })();

  /* =========================================================================
   * 12. EXAMINATIONS
   * ====================================================================== */

  function examDates(offsetStart, offsetEnd) {
    const start = new Date(SESSION_START_YEAR, 3, 1);
    const startDate = new Date(start.getFullYear(), start.getMonth() + offsetStart, randInt(6, 24));
    const endDate = new Date(start.getFullYear(), start.getMonth() + offsetEnd, randInt(4, 28));
    return { startDate: isoDate(startDate), endDate: isoDate(endDate) };
  }

  /**
   * Exam sittings. The school day runs 08:00 - 13:30 (school.timings) with a
   * Friday break, so three papers a day at 08:30 / 10:30 / 12:30 is what fits.
   * Each subject gets one sitting; `getExamPapers()` then crosses those
   * sittings with the classes the exam runs for, which is where the
   * subject + class + date + time quartet the dashboard shows comes from.
   */
  const EXAM_SITTING_TIMES = ['08:30', '10:30', '12:30'];
  const FRIDAY = 5;          // the weekly break — no sittings, no roll call

  /** Builds one sitting per subject, three subjects to a day. */
  function examSittings(exam) {
    const span = Math.max(0, daysBetween(exam.startDate, exam.endDate));
    const usableDays = Math.max(1, span + 1);
    return exam.subjects.map(function (subject, index) {
      const dayIndex = Math.floor(index / EXAM_SITTING_TIMES.length);
      // Wrap around the window if an exam lists more subjects than it has
      // days, so a sitting can never land outside start..end.
      let offset = dayIndex % usableDays;
      let date = addDaysIso(exam.startDate, offset);
      if (new Date(date.slice(0, 4), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).getDay() === FRIDAY) {
        offset += 1;                 // the Friday break: shift to the next day
        date = addDaysIso(exam.startDate, offset);
      }
      return {
        subject: subject,
        date: date,
        time: EXAM_SITTING_TIMES[index % EXAM_SITTING_TIMES.length],
        seat: (index % EXAM_SITTING_TIMES.length) + 1
      };
    });
  }

  const EXAMS = [
    {
      id: 'EXM-01', name: 'First Term Unit Test', type: 'Unit Test',
      classes: ['Playgroup', 'Nursery', 'Prep', 'Grade 1', 'Grade 2'],
      subjects: ['English', 'Urdu', 'Mathematics', 'General Knowledge'],
      grade: 'Lower Primary', weightage: 10
    },
    {
      id: 'EXM-02', name: 'First Term Examination', type: 'Term Exam',
      classes: CLASSES.map(function (klass) { return klass.name; }),
      subjects: SUBJECT_NAMES.slice(),
      grade: 'All Classes', weightage: 30
    },
    {
      id: 'EXM-03', name: 'Science Practical & Viva', type: 'Practical',
      classes: ['Grade 9', 'Grade 10'],
      subjects: ['Physics', 'Chemistry', 'Biology'],
      grade: 'Secondary Science', weightage: 10
    },
    {
      id: 'EXM-04', name: 'Mid-Session Assessment', type: 'Assessment',
      classes: CLASSES.map(function (klass) { return klass.name; }),
      subjects: ['English', 'Urdu', 'Sindhi', 'Mathematics', 'Science', 'Islamiyat', 'Social Studies'],
      grade: 'All Classes', weightage: 20
    },
    {
      id: 'EXM-05', name: 'Second Term Examination', type: 'Term Exam',
      classes: CLASSES.map(function (klass) { return klass.name; }),
      subjects: SUBJECT_NAMES.slice(),
      grade: 'All Classes', weightage: 30
    },
    {
      id: 'EXM-06', name: 'Annual Examination', type: 'Annual Exam',
      classes: ['Prep', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
      subjects: SUBJECT_NAMES.slice(),
      grade: 'Grade 1 to Grade 10', weightage: 40
    }
  ].map(function (exam, index) {
    /* Month offsets from the start of the session (0 = April, 11 = March), so
       every exam window stays inside the April-to-March session. The last one
       is the annual exam in Feb-Mar; there is nothing after it. */
    const offsets = [[1, 1], [2, 3], [4, 4], [5, 6], [8, 9], [10, 11]][index];
    const dates = examDates(offsets[0], offsets[1]);
    exam.startDate = dates.startDate;
    exam.endDate = dates.endDate;
    exam.subjectCount = exam.subjects.length;
    exam.classCount = exam.classes.length;
    exam.sittingTimes = EXAM_SITTING_TIMES.slice();
    exam.papersPerDay = EXAM_SITTING_TIMES.length;
    exam.sittings = examSittings(exam);
    /* Status follows the calendar instead of being typed in by hand, so
       "Upcoming" on the dashboard can never drift away from the dates. */
    const today = dateKey(NOW);
    exam.status = exam.endDate < today ? 'Completed'
      : (exam.startDate <= today ? 'Ongoing' : 'Upcoming');
    exam.inSession = exam.startDate >= ACADEMIC_SESSION.startDate && exam.endDate <= ACADEMIC_SESSION.endDate;
    return exam;
  });

  /* =========================================================================
   * 13. ASSIGNMENTS
   * ====================================================================== */

  const ASSIGNMENT_TITLES = {
    'English': ['Write a paragraph on "My Family"', 'Read the story and answer the questions', 'Learn the poem for recitation', 'Write a letter to your friend'],
    'Urdu': ['مضمون تحریر کریں: اپنے دوست کے بارے میں', 'گزرے ہوئے سبق کا خلاصہ لکھیں', 'تلفظ کریں اور مشق کریں', 'تھیم پر گایا لکھیں'],
    'Sindhi': ['مضمون لکھو', 'گفتگو جو ڪيتي ان لکھو', 'تلفظ جو مشق ڪريو'],
    'Mathematics': ['Complete exercises 3.1 to 3.5', 'Solve the word problems on page 42', 'Practice tables 11 to 15', 'Complete the worksheet on fractions'],
    'Science': ['Draw and label the plant cell', 'Answer the observation questions', 'Write the experiment report'],
    'Computer Science': ['Type the given passage in MS Word', 'Complete the HTML tags exercise', 'Make a chart in Excel'],
    'Islamiyat': ['Answer the questions from Surah Al-Fatihah', 'Write about the life of the Prophet (PBUH)'],
    'Social Studies': ['Complete the map work activity', 'Write about the Indus Valley Civilisation'],
    'Pakistan Studies': ['Answer the questions on the Pakistan Movement', 'Complete the timeline chart'],
    'Physics': ['Numericals from chapter 3', 'Complete the numericals worksheet'],
    'Chemistry': ['Balance the given chemical equations', 'Write the experiment procedure'],
    'Biology': ['Draw the human digestive system', 'Answer the diagram-based questions'],
    'General Knowledge': ['Complete the GK worksheet', 'Write about five facts from Pakistan'],
    'Drawing/Art': ['Complete the colour wash painting', 'Draw a landscape scene'],
    'Physical Education': ['Practice the given drill', 'Complete the fitness diary']
  };

  const ASSIGNMENTS = (function buildAssignments() {
    const list = [];
    let counter = 0;
    SECTIONS.forEach(function (section) {
      section.subjects.forEach(function (subject) {
        if (rng() > 0.12) return;   // sample the assignment board, keep it readable
        counter++;
        const entry = section.roster.filter(function (item) {
          return item.subjects.indexOf(subject) !== -1;
        })[0];
        const teacher = entry ? TEACHER_BY_ID[entry.teacherId] : null;
        const titles = ASSIGNMENT_TITLES[subject] || ['Complete the given exercise'];
        const assignedDate = new Date(NOW.getTime() - randInt(0, 20) * 86400000);
        const dueDate = new Date(assignedDate.getTime() + randInt(3, 14) * 86400000);
        const total = section.students;
        const submitted = Math.round(total * randFloat(0.35, 1, 2));
        list.push({
          id: 'ASG-' + pad(counter, 4),
          title: pick(titles),
          subject: subject,
          className: section.className,
          sectionName: section.sectionName,
          sectionId: section.id,
          teacherId: teacher ? teacher.id : null,
          teacherName: teacher ? teacher.name : '—',
          assignedDate: isoDate(assignedDate),
          dueDate: isoDate(dueDate),
          submitted: submitted,
          totalStudents: total,
          status: submitted >= total ? 'Graded' : (submitted > 0 ? 'Submitted' : 'Pending'),
          lateSubmissionDays: randInt(0, 5)
        });
      });
    });
    return list;
  })();

  /* =========================================================================
   * 14. ANNOUNCEMENTS
   * ====================================================================== */

  /** How many days ago each announcement was published (index aligned). */
  const ANNOUNCEMENT_AGE_DAYS = [1, 3, 6, 9, 12, 16, 21, 27, 34, 41];

  const ANNOUNCEMENTS = [
    {
      id: 'ANN-01', title: 'Parent–Teacher Meeting (Session ' + ACADEMIC_SESSION.label + ', Term 1)',
      body: 'The first parent–teacher meeting is scheduled for Saturday at 08:30 in the school hall. '
        + 'Class teachers will share term progress and fee statements. Please bring the student\'s progress card.',
      audience: 'Parents & Guardians', category: 'Event', priority: 'Important',
      author: 'Principal', pinned: true
    },
    {
      id: 'ANN-02', title: 'Fee submission deadline for the current month',
      body: 'Monthly tuition and lab fees are due on the 10th of every month. A 2% late fine applies after the deadline. '
        + 'The fee counter is open from 08:00 to 13:00 Monday to Saturday.',
      audience: 'Parents & Guardians', category: 'Fees', priority: 'Urgent',
      author: "Accounts Department", pinned: true
    },
    {
      id: 'ANN-03', title: 'Science fair — Grade 6 to Grade 10',
      body: 'Inter-class science fair projects are due two weeks from today. Teams of three will present working models '
        + 'in the school ground. Contact the subject teacher for the project template.',
      audience: 'Students & Parents', category: 'Academic', priority: 'Normal',
      author: 'Science Department'
    },
    {
      id: 'ANN-04', title: 'Second Term Examination schedule published',
      body: 'The Second Term Examination timetable (Session ' + ACADEMIC_SESSION.label + ') has been published on the '
        + 'notice board and in the parent portal. Exams begin after the mid-session assessment.',
      audience: 'Students & Parents', category: 'Examination', priority: 'Important',
      author: 'Controller of Examinations'
    },
    {
      id: 'ANN-05', title: 'Sports week — inter-house competition',
      body: 'Annual sports week starts next Monday: 100m race, long jump, tug of war, kho-kho and tug-of-war finals. '
        + 'House in-charges must submit team lists to the sports office.',
      audience: 'Students & Staff', category: 'Event', priority: 'Normal',
      author: 'Sports Coordinator'
    },
    {
      id: 'ANN-06', title: 'Library week and new book arrivals',
      body: 'Library week features a reading challenge, story hour for the pre-primary section and a book exchange stall. '
        + 'Issued books are due back within seven days.',
      audience: 'Students', category: 'Co-curricular', priority: 'Normal',
      author: 'Librarian'
    },
    {
      id: 'ANN-07', title: 'Staff meeting — curriculum revision',
      body: 'All subject heads are required to attend the curriculum revision meeting in the conference room. '
        + 'Agenda: term-wise syllabus coverage, assessment weighting and remedial classes.',
      audience: 'Teachers & Staff', category: 'Staff', priority: 'Important',
      author: "Vice Principal"
    },
    {
      id: 'ANN-08', title: 'Winter uniform w.e.f. first Monday of November',
      body: 'Students must switch to the winter uniform (navy cardigan with school crest) from the first Monday of November.',
      audience: 'Students & Parents', category: 'Uniform', priority: 'Normal',
      author: 'Administration'
    },
    {
      id: 'ANN-09', title: 'Health camp — free eye and general check-up',
      body: 'A free health camp will be held in the school clinic. Parents may opt in for eye screening, dental check-up '
        + 'and growth measurement. Consent forms are available at the front office.',
      audience: 'Students & Parents', category: 'Wellness', priority: 'Normal',
      author: 'School Nurse'
    },
    {
      id: 'ANN-10', title: 'Admission open for the new session',
      body: 'Online applications for Playgroup to Grade 10 are open. Applicants must submit the last report card, '
        + 'two passport photographs and a copy of the guardian CNIC. No real student data is used in this demo system.',
      audience: 'Prospective Parents', category: 'Admission', priority: 'Normal',
      author: 'Admission Cell'
    }
  ].map(function (item, index) {
    const published = new Date(NOW.getTime() - ANNOUNCEMENT_AGE_DAYS[index % ANNOUNCEMENT_AGE_DAYS.length] * 86400000);
    item.publishedDate = isoDate(published);
    item.readCount = randInt(24, 480);
    return item;
  });

  /* =========================================================================
   * 15. ATTENDANCE (deterministic, derived — nothing is stored)
   * ====================================================================== */

  function dateKey(date) { return isoDate(date); }

  /**
   * Attendance of one student on one date, derived from a hash of
   * student id + date, so every page always shows the same figure.
   */
  function attendanceOf(student, isoDay) {
    const rand = rngFrom(student.id + '|' + isoDay);
    const roll = rand();
    if (roll < 0.874) return 'Present';
    if (roll < 0.927) return 'Absent';
    if (roll < 0.975) return 'Leave';
    return 'Late';
  }

  /** School days between two dates, excluding Friday. */
  function schoolDaysBetween(fromDate, toDate) {
    const days = [];
    const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    let guard = 0;
    while (cursor <= end && guard < 800) {
      if (cursor.getDay() !== 5) days.push(dateKey(cursor));   // 5 === Friday
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return days;
  }

  /** Roll-call for one section on one date. */
  function sectionAttendance(className, sectionName, isoDay) {
    const section = SECTIONS.filter(function (item) {
      return item.className === className && item.sectionName === sectionName;
    })[0];
    if (!section) return null;
    const rows = STUDENTS_BY_SECTION[section.id].map(function (student) {
      return { student: student, status: attendanceOf(student, isoDay) };
    });
    return {
      date: isoDay,
      className: className,
      sectionName: sectionName,
      sectionId: section.id,
      classTeacherId: section.classTeacherId,
      records: rows,
      summary: summariseAttendance(rows)
    };
  }

  function summariseAttendance(rows) {
    const summary = { present: 0, absent: 0, leave: 0, late: 0, total: rows.length };
    rows.forEach(function (row) {
      const status = String(typeof row === 'string' ? row : row.status).toLowerCase();
      if (summary[status] !== undefined) summary[status]++;
    });
    summary.marked = summary.total;
    summary.percent = summary.total ? Math.round(((summary.present + summary.late) / summary.total) * 1000) / 10 : 0;
    return summary;
  }

  /** Whole-school attendance for a date (default: today). */
  function attendanceSummary(isoDay) {
    const day = isoDay || dateKey(NOW);
    const rows = STUDENTS.map(function (student) {
      return { status: attendanceOf(student, day) };
    });
    const summary = summariseAttendance(rows);
    summary.date = day;
    summary.byClass = CLASSES.map(function (klass) {
      const classRows = STUDENTS_BY_CLASS[klass.name].map(function (student) {
        return { status: attendanceOf(student, day) };
      });
      const classSummary = summariseAttendance(classRows);
      classSummary.className = klass.name;
      return classSummary;
    });
    return summary;
  }

  /** Month-to-date attendance of one section, day by day. */
  function sectionAttendanceMatrix(className, sectionName, days) {
    const section = SECTIONS.filter(function (item) {
      return item.className === className && item.sectionName === sectionName;
    })[0];
    if (!section) return null;
    const roster = STUDENTS_BY_SECTION[section.id];
    const limit = Math.min(days || 22, 60);
    const monthStart = new Date(SESSION_START_YEAR, 3, 1);
    const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    const schoolDays = schoolDaysBetween(monthStart, today).slice(-limit);
    const matrix = roster.map(function (student) {
      const perDay = schoolDays.map(function (day) {
        return { date: day, status: attendanceOf(student, day) };
      });
      const tally = summariseAttendance(perDay);
      return { student: student, days: perDay, summary: tally };
    });
    return {
      className: className,
      sectionName: sectionName,
      sectionId: section.id,
      dates: schoolDays,
      matrix: matrix
    };
  }

  /* =========================================================================
   * 16. PUBLIC HELPERS
   * ====================================================================== */

  const helpers = {

    /* --- Classes & sections ------------------------------------------- */

    /** All classes (optionally filtered by stage). */
    getClasses: function (stage) {
      return stage ? CLASSES.filter(function (klass) { return klass.stage === stage; }) : CLASSES.slice();
    },

    /** All sections, optionally filtered. */
    getSections: function (className, sectionName) {
      return SECTIONS.filter(function (section) {
        if (className && section.className !== className) return false;
        if (sectionName && section.sectionName !== sectionName) return false;
        return true;
      });
    },

    /** One section by id, e.g. "G3-B". */
    getSection: function (sectionId) {
      return SECTIONS.filter(function (section) { return section.id === sectionId; })[0] || null;
    },

    /** Class object by display name or id. */
    getClass: function (classNameOrId) {
      return CLASSES.filter(function (klass) {
        return klass.name === classNameOrId || klass.id === classNameOrId;
      })[0] || null;
    },

    getSubjects: function (group) {
      return group ? SUBJECTS.filter(function (subject) { return subject.group === group; }) : SUBJECTS.slice();
    },

    getSubject: function (subjectNameOrId) {
      return SUBJECTS.filter(function (subject) {
        return subject.name === subjectNameOrId || subject.id === subjectNameOrId;
      })[0] || null;
    },

    /** Subjects on the timetable of a given class. */
    getClassSubjects: function (className) {
      const klass = helpers.getClass(className);
      return klass ? klass.subjects.slice() : [];
    },

    /* --- Students ------------------------------------------------------ */

    /**
     * Students of a class (and optionally one section).
     * getStudentsByClass()               -> all 2000 students
     * getStudentsByClass('Grade 5')     -> every Grade 5 student
     * getStudentsByClass('Grade 5','B') -> Grade 5 - B
     */
    getStudentsByClass: function (className, sectionName) {
      if (!className) return STUDENTS.slice();
      const byClass = STUDENTS_BY_CLASS[className] || [];
      if (!sectionName) return byClass.slice();
      return byClass.filter(function (student) { return student.sectionName === sectionName; });
    },

    /** Students of a section id, e.g. "G3-B". */
    getStudentsBySection: function (sectionId) {
      return (STUDENTS_BY_SECTION[sectionId] || []).slice();
    },

    getStudentById: function (studentId) {
      return STUDENT_INDEX[studentId] || null;
    },

    /** Teacher assigned as class teacher of a section. */
    getClassTeacher: function (className, sectionName) {
      const section = SECTIONS.filter(function (item) {
        return item.className === className && item.sectionName === sectionName;
      })[0];
      return section && section.classTeacherId ? TEACHER_BY_ID[section.classTeacherId] : null;
    },

    /**
     * Per-class roll-up used by the dashboard, the classes page and the
     * student-page filter summary.
     */
    getClassSummary: function () {
      return CLASSES.map(function (klass) {
        const sections = klass.sections;
        const subjects = klass.subjects;
        const avgAttendance = Math.round(
          (STUDENTS_BY_CLASS[klass.name].reduce(function (sum, student) {
            return sum + student.attendance;
          }, 0) / (STUDENTS_BY_CLASS[klass.name].length || 1)) * 10
        ) / 10;
        const fee = FEE_STRUCTURE_BY_CLASS[klass.name];
        return {
          classId: klass.id,
          className: klass.name,
          code: klass.code,
          order: klass.order,
          stage: klass.stage,
          ageLabel: klass.ageLabel,
          totalStudents: STUDENTS_BY_CLASS[klass.name].length,
          boys: klass.boys,
          girls: klass.girls,
          sections: sections,
          sectionCount: sections.length,
          subjects: subjects,
          subjectCount: subjects.length,
          avgAttendance: avgAttendance,
          monthlyFee: fee ? fee.monthlyTuition : 0,
          feeStructure: fee,
          classTeachers: sections.map(function (section) {
            return {
              sectionId: section.id,
              sectionName: section.sectionName,
              classTeacherId: section.classTeacherId,
              classTeacherName: section.classTeacherName,
              students: section.students,
              boys: section.boys,
              girls: section.girls
            };
          })
        };
      });
    },

    /* --- Teachers ------------------------------------------------------ */

    getTeachers: function (subjectOrStatus) {
      if (!subjectOrStatus) return TEACHERS.slice();
      return TEACHERS.filter(function (teacher) {
        return teacher.mainSubject === subjectOrStatus || teacher.status === subjectOrStatus;
      });
    },

    getTeacherById: function (teacherId) {
      return TEACHER_BY_ID[teacherId] || null;
    },

    getTeachersBySubject: function (subjectName) {
      return TEACHERS.filter(function (teacher) {
        return teacher.mainSubject === subjectName;
      });
    },

    /** Subjects of one class with the teacher who takes them, per section. */
    getSubjectAllocation: function (className, sectionName) {
      const section = SECTIONS.filter(function (item) {
        return item.className === className && item.sectionName === sectionName;
      })[0];
      if (!section) return [];
      return section.roster.map(function (entry) {
        return {
          teacherId: entry.teacherId,
          teacherName: TEACHER_BY_ID[entry.teacherId].name,
          subjects: entry.subjects.slice(),
          isClassTeacher: entry.teacherId === section.classTeacherId
        };
      });
    },

    /* --- Fees ---------------------------------------------------------- */

    getFeeStructure: function (className) {
      return FEE_STRUCTURE_BY_CLASS[className] || null;
    },

    /**
     * Fee collection roll-up for the current session (PKR).
     */
    getFeeSummary: function () {
      const expected = STUDENTS.reduce(function (sum, student) { return sum + student.feeExpected; }, 0);
      const collected = STUDENTS.reduce(function (sum, student) { return sum + student.feePaid; }, 0);
      const byStatus = { Paid: 0, Pending: 0, Partial: 0, Overdue: 0 };
      STUDENTS.forEach(function (student) { byStatus[student.feeStatus]++; });

      const byClass = CLASSES.map(function (klass) {
        const roster = STUDENTS_BY_CLASS[klass.name];
        const classExpected = roster.reduce(function (sum, student) { return sum + student.feeExpected; }, 0);
        const classCollected = roster.reduce(function (sum, student) { return sum + student.feePaid; }, 0);
        return {
          className: klass.name,
          students: roster.length,
          monthlyTuition: FEE_STRUCTURE_BY_CLASS[klass.name].monthlyTuition,
          expected: classExpected,
          collected: classCollected,
          outstanding: classExpected - classCollected,
          percent: classExpected ? Math.round((classCollected / classExpected) * 1000) / 10 : 0
        };
      });

      return {
        currency: FEES.currency,
        session: ACADEMIC_SESSION.label,
        monthsElapsed: ACADEMIC_SESSION.currentMonthIndex + 1,
        totalMonths: 12,
        totalStudents: STUDENTS.length,
        expected: expected,
        collected: collected,
        outstanding: expected - collected,
        percent: expected ? Math.round((collected / expected) * 1000) / 10 : 0,
        byStatus: byStatus,
        byClass: byClass,
        structures: FEES.structures,
        discounts: FEES.discountRules,
        lateFinePercent: FEES.lateFinePercent
      };
    },

    /**
     * The current session month on its own (PKR).
     *
     * The demo ledger stores one cumulative figure per student
     * (`feeExpected` / `feePaid` / `feeBalance`), not a month-by-month
     * statement. So "this month" is derived, not invented: a student's monthly
     * tuition is the class figure, and the slice of the money already received
     * that covers it is `feePaid` spread evenly over the months elapsed so far
     * and capped at that month's tuition. Nothing is estimated per student
     * beyond that arithmetic, and the totals below always add back up:
     * `billed = collected + pending`.
     */
    getMonthlyFeeSummary: function () {
      const monthIndex = ACADEMIC_SESSION.currentMonthIndex;   // 0 = April
      const monthsElapsed = Math.max(1, monthIndex + 1);
      const monthName = MONTHS[(3 + monthIndex) % 12];
      const monthShort = MONTHS_SHORT[(3 + monthIndex) % 12];

      let billed = 0;
      let collected = 0;
      const byClass = CLASSES.map(function (klass) {
        const roster = STUDENTS_BY_CLASS[klass.name];
        const tuition = FEE_STRUCTURE_BY_CLASS[klass.name].monthlyTuition;
        let classBilled = 0;
        let classCollected = 0;
        roster.forEach(function (student) {
          const covered = Math.min(tuition, Math.round(student.feePaid / monthsElapsed));
          classBilled += tuition;
          classCollected += covered;
        });
        return {
          className: klass.name,
          code: klass.code,
          students: roster.length,
          monthlyTuition: tuition,
          billed: classBilled,
          collected: classCollected,
          pending: classBilled - classCollected,
          percent: classBilled ? Math.round((classCollected / classBilled) * 1000) / 10 : 0
        };
      });
      byClass.forEach(function (row) {
        billed += row.billed;
        collected += row.collected;
      });

      const byStatus = { Paid: 0, Pending: 0, Partial: 0, Overdue: 0 };
      STUDENTS.forEach(function (student) { byStatus[student.feeStatus]++; });

      return {
        currency: FEES.currency,
        currencySymbol: FEES.currencySymbol,
        session: ACADEMIC_SESSION.label,
        monthIndex: monthIndex,
        monthName: monthName,
        monthShort: monthShort,
        monthsElapsed: monthsElapsed,
        totalMonths: 12,
        totalStudents: STUDENTS.length,
        billed: billed,
        collected: collected,
        pending: billed - collected,
        percent: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
        byStatus: byStatus,
        byClass: byClass,
        lateFinePercent: FEES.lateFinePercent
      };
    },

    /* --- Exams, assignments, announcements ------------------------------ */

    getExams: function (status) {
      return status ? EXAMS.filter(function (exam) { return exam.status === status; }) : EXAMS.slice();
    },

    /**
     * Exam papers as subject + class + date + time, in date order.
     *
     * An exam lists the classes it runs for and one sitting per subject; this
     * crosses the two, which is the row the dashboard "Upcoming exams" card and
     * the exams module both need. Returned as a plain array — callers are
     * expected to slice or page it rather than render it whole.
     *
     * @param {Object} [options]
     * @param {string} [options.examId]     only this exam
     * @param {string[]} [options.status]   only exams with these statuses
     * @param {string} [options.fromDate]   ignore sittings before this date
     * @param {string} [options.className]  only this class
     * @param {string} [options.subject]    only this subject
     * @returns {Array<Object>}
     */
    getExamPapers: function (options) {
      const opts = options || {};
      const rows = [];

      EXAMS.forEach(function (exam) {
        if (opts.examId && exam.id !== opts.examId) return;
        if (opts.status && opts.status.indexOf(exam.status) === -1) return;

        exam.sittings.forEach(function (sitting) {
          if (opts.subject && sitting.subject !== opts.subject) return;
          if (opts.fromDate && sitting.date < opts.fromDate) return;
          exam.classes.forEach(function (className) {
            if (opts.className && className !== opts.className) return;
            const klass = CLASS_BY_NAME[className];
            rows.push({
              examId: exam.id,
              examName: exam.name,
              examType: exam.type,
              examStatus: exam.status,
              weightage: exam.weightage,
              subject: sitting.subject,
              className: className,
              classOrder: klass ? klass.order : 99,
              date: sitting.date,
              time: sitting.time,
              seat: sitting.seat
            });
          });
        });
      });

      rows.sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.time !== b.time) return a.time < b.time ? -1 : 1;
        /* Class order, not alphabetical — otherwise Grade 10 sorts before Grade 2. */
        if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
        return a.subject < b.subject ? -1 : 1;
      });
      return rows;
    },

    getAssignments: function (className, sectionName, subject) {
      return ASSIGNMENTS.filter(function (item) {
        if (className && item.className !== className) return false;
        if (sectionName && item.sectionName !== sectionName) return false;
        if (subject && item.subject !== subject) return false;
        return true;
      });
    },

    getAnnouncements: function (audience) {
      return audience ? ANNOUNCEMENTS.filter(function (item) { return item.audience === audience; }) : ANNOUNCEMENTS.slice();
    },

    /* --- Attendance ----------------------------------------------------- */

    getAttendanceToday: function () { return attendanceSummary(dateKey(NOW)); },
    getAttendanceSummary: attendanceSummary,
    getSectionAttendance: sectionAttendance,
    getSectionAttendanceMatrix: sectionAttendanceMatrix,
    attendanceOf: attendanceOf,
    summariseAttendance: summariseAttendance,

    /**
     * Whole-school attendance for the last `days` school days, oldest first.
     *
     * Friday is skipped for the same reason schoolDaysBetween() skips it: it is
     * the weekly break, so a flat zero would be a holiday, not absenteeism.
     * Reading the trend backwards from today also means the last point is
     * always today, which is what the dashboard labels.
     *
     * Each day is summarised straight from STUDENTS rather than through
     * attendanceSummary() because the per-class breakdown that
     * attendanceSummary() also builds is not needed here.
     */
    getAttendanceTrend: function (days) {
      const limit = Math.max(1, Math.min(31, Number(days) || 7));
      const wanted = [];
      const cursor = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
      let guard = 0;
      while (wanted.length < limit && guard < 400) {
        if (cursor.getDay() !== FRIDAY) wanted.unshift(dateKey(cursor));
        cursor.setDate(cursor.getDate() - 1);
        guard++;
      }

      const today = dateKey(NOW);
      return wanted.map(function (day) {
        const summary = summariseAttendance(STUDENTS.map(function (student) {
          return { status: attendanceOf(student, day) };
        }));
        const date = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
        summary.date = day;
        summary.isToday = day === today;
        /* WEEKDAY_NAMES, not MONTHS: getDay() is 0-6 and MONTHS is 1-12. */
        summary.weekday = WEEKDAY_NAMES[date.getDay()];
        summary.weekdayShort = WEEKDAY_NAMES[date.getDay()].slice(0, 3);
        summary.dayOfMonth = date.getDate();
        summary.monthShort = helpers.monthsShort[date.getMonth()];
        return summary;
      });
    },

    /* --- Cohort breakdowns ---------------------------------------------- */

    /**
     * Boys / girls split for the whole school, per stage and per class.
     * Counts only — the view decides which colour each segment gets.
     */
    getGenderSummary: function () {
      const split = function (roster) {
        const boys = roster.filter(function (student) { return student.gender === 'Male'; }).length;
        const girls = roster.length - boys;
        return {
          total: roster.length,
          boys: boys,
          girls: girls,
          boyPercent: roster.length ? Math.round((boys / roster.length) * 1000) / 10 : 0,
          girlPercent: roster.length ? Math.round((girls / roster.length) * 1000) / 10 : 0
        };
      };

      const stages = [];
      CLASSES.forEach(function (klass) {
        if (stages.indexOf(klass.stage) === -1) stages.push(klass.stage);
      });

      return {
        school: split(STUDENTS),
        byStage: stages.map(function (stage) {
          const result = split(CLASSES.reduce(function (all, klass) {
            return klass.stage === stage ? all.concat(STUDENTS_BY_CLASS[klass.name]) : all;
          }, []));
          result.stage = stage;
          return result;
        }),
        byClass: CLASSES.map(function (klass) {
          const result = split(STUDENTS_BY_CLASS[klass.name]);
          result.className = klass.name;
          result.code = klass.code;
          return result;
        })
      };
    },

    /**
     * Recent school activity, newest first.
     *
     * The demo data has no activity log, so this derives a feed from the dated
     * records that do exist — admissions, announcements, exam sittings,
     * assignments, today's roll call and the fee position — and merges them by
     * date. Each entry carries a `kind` tag; the view maps that to an icon and
     * a colour, because a data layer should not know about either.
     */
    getRecentActivity: function (limit) {
      const wanted = Math.max(1, Math.min(50, Number(limit) || 8));
      const items = [];

      /* Most recent admissions. */
      STUDENTS.slice()
        .sort(function (a, b) { return a.admissionDate < b.admissionDate ? 1 : -1; })
        .slice(0, 3)
        .forEach(function (student) {
          items.push({
            kind: 'admission',
            date: student.admissionDate,
            title: student.name + ' joined ' + student.className + ' - ' + student.sectionName,
            detail: 'Roll ' + student.rollNo + ' • ' + student.grNo + ' • guardian ' + student.guardian,
            ref: { page: 'students', id: student.id }
          });
        });

      /* Latest announcements — pinned first, as the notice board does. */
      ANNOUNCEMENTS.slice()
        .sort(function (a, b) {
          if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
          return a.publishedDate < b.publishedDate ? 1 : -1;
        })
        .slice(0, 3)
        .forEach(function (item) {
          items.push({
            kind: 'announcement',
            date: item.publishedDate,
            title: item.title,
            detail: item.priority + ' • ' + item.audience + ' • ' + item.author,
            tone: item.priority,
            ref: { page: 'announcements', id: item.id }
          });
        });

      /* Exams: a result released, or a paper that has begun. Only exams whose
         event has actually happened belong in a feed of what *has* happened —
         an exam starting in February 2027 is the dashboard's "upcoming" card,
         not its "recent activity". */
      const feedToday = dateKey(NOW);
      EXAMS.forEach(function (exam) {
        const eventDate = exam.status === 'Completed' ? exam.endDate : exam.startDate;
        if (eventDate > feedToday) return;
        items.push({
          kind: 'exam',
          date: eventDate,
          title: exam.name + (exam.status === 'Completed' ? ' results declared' : ' begins'),
          detail: exam.type + ' • ' + exam.classCount + ' classes • ' + exam.subjectCount
            + ' subjects • ' + exam.weightage + '% weight',
          tone: exam.status,
          ref: { page: 'exams', id: exam.id }
        });
      });

      /* Assignments handed out, and the ones whose submissions have closed.
         Same rule: a due date still to come is a deadline, not an event. */
      const sortedAssignments = ASSIGNMENTS.slice().sort(function (a, b) {
        return a.assignedDate < b.assignedDate ? 1 : -1;
      });
      sortedAssignments.slice(0, 2).forEach(function (item) {
        items.push({
          kind: 'assignment',
          date: item.assignedDate,
          title: item.title,
          detail: item.subject + ' • ' + item.className + ' - ' + item.sectionName
            + ' • set by ' + item.teacherName + ' • due ' + item.dueDate,
          ref: { page: 'assignments', id: item.id }
        });
      });
      sortedAssignments.slice()
        .filter(function (item) { return item.dueDate <= feedToday; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? 1 : -1; })
        .slice(0, 1)
        .forEach(function (item) {
          items.push({
            kind: 'assignment',
            date: item.dueDate,
            title: item.title + ' — submissions closed',
            detail: item.subject + ' • ' + item.className + ' - ' + item.sectionName
              + ' • ' + item.submitted + ' of ' + item.totalStudents + ' submitted',
            tone: item.status,
            ref: { page: 'assignments', id: item.id }
          });
        });

      /* Today's roll call. */
      const today = attendanceSummary(dateKey(NOW));
      items.push({
        kind: 'attendance',
        date: today.date,
        title: 'Attendance register marked for all ' + helpers.formatNumber(STUDENTS.length) + ' students',
        detail: today.percent.toFixed(1) + '% present • ' + helpers.formatNumber(today.absent) + ' absent • '
          + helpers.formatNumber(today.leave) + ' on leave • ' + helpers.formatNumber(today.late) + ' late',
        tone: today.percent >= 90 ? 'Present' : 'Low',
        ref: { page: 'attendance' }
      });

      /* Fee position for the session. */
      const fees = helpers.getFeeSummary();
      items.push({
        kind: 'fees',
        date: dateKey(NOW),
        title: 'Fee collection at ' + fees.percent.toFixed(1) + '% for session ' + fees.session,
        detail: helpers.formatPKR(fees.collected) + ' received • ' + helpers.formatPKR(fees.outstanding)
          + ' outstanding across ' + fees.monthsElapsed + ' months',
        tone: fees.percent >= 85 ? 'Collected' : 'Low',
        ref: { page: 'fees' }
      });

      items.sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.title < b.title ? -1 : 1;
      });
      return items.slice(0, wanted);
    },

    /* --- Sessions & lookups -------------------------------------------- */

    getAcademicSession: function () { return Object.assign({}, ACADEMIC_SESSION); },
    getClassOptions: function () {
      return CLASSES.map(function (klass) {
        return { value: klass.name, label: klass.name, code: klass.code };
      });
    },
    getSectionOptions: function (className) {
      return helpers.getSections(className).map(function (section) {
        return { value: section.sectionName, label: section.label, id: section.id };
      });
    },
    getSubjectOptions: function () {
      return SUBJECTS.map(function (subject) {
        return { value: subject.name, label: subject.name, group: subject.group };
      });
    },

    /* --- Formatting ------------------------------------------------------ */

    formatPKR: function (amount) {
      const rounded = Math.round(Number(amount) || 0);
      const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return 'Rs ' + (rounded < 0 ? '-' : '') + grouped;
    },

    formatNumber: function (value) {
      return String(Number(value) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    formatDate: function (isoDay, style) {
      if (!isoDay) return '—';
      const parts = String(isoDay).split('-');
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(date.getTime())) return isoDay;
      const day = pad(date.getDate(), 2);
      const month = MONTHS_SHORT[date.getMonth()];
      if (style === 'long') {
        return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
      }
      if (style === 'medium') return day + ' ' + month + ' ' + date.getFullYear();
      return isoDay;
    },

    formatPhone: function (phone) { return phone || '—'; },

    initials: function (name) {
      if (!name) return '?';
      const parts = String(name).trim().split(/\s+/);
      const first = parts[0] ? parts[0].charAt(0) : '';
      const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
      return (first + last).toUpperCase();
    },

    /** Deterministic PRNG, exposed so pages can generate stable demo extras. */
    seededRandom: rngFrom,
    months: MONTHS,
    monthsShort: MONTHS_SHORT,
    pad: pad
  };

  /* =========================================================================
   * 17. STUDENT RECORD MUTATIONS (add / edit / delete)
   *
   * The register is the one page a school clerk actually writes to, so the
   * records have to be changeable at runtime. That matters because STUDENTS
   * is not a plain array: four things are derived from it and every screen
   * reads those, not the array itself.
   *
   *   STUDENT_INDEX          id -> record
   *   STUDENTS_BY_SECTION    section id -> records   (attendance, roll call)
   *   STUDENTS_BY_CLASS      class name -> records   (class summary, fees)
   *   SECTIONS[].students/boys/girls, CLASSES[].studentCount/boys/girls
   *
   * Mutating STUDENTS directly would leave all four stale, and the dashboard,
   * class summary, gender split and attendance pages would quietly disagree
   * with the register. So every mutation goes through here, which is the only
   * place allowed to write to those structures. Mutations are in-memory by
   * design: this is a front-end prototype, so a reload restores the seed.
   * ====================================================================== */

  /** Recompute every denormalised head-count from the by-section index. */
  function recountSectionsAndClasses() {
    SECTIONS.forEach(function (section) {
      const roster = STUDENTS_BY_SECTION[section.id] || [];
      section.students = roster.length;
      section.boys = roster.filter(function (student) { return student.gender === 'Male'; }).length;
      section.girls = roster.filter(function (student) { return student.gender === 'Female'; }).length;
    });
    CLASSES.forEach(function (klass) {
      const roster = STUDENTS_BY_CLASS[klass.name] || [];
      klass.studentCount = roster.length;
      klass.boys = roster.filter(function (student) { return student.gender === 'Male'; }).length;
      klass.girls = roster.filter(function (student) { return student.gender === 'Female'; }).length;
    });
  }

  /** Drop a record from both grouping indexes, by object identity. */
  function ungroupStudent(student, sectionId, className) {
    const bySection = STUDENTS_BY_SECTION[sectionId];
    const byClass = STUDENTS_BY_CLASS[className];
    if (bySection) {
      const at = bySection.indexOf(student);
      if (at !== -1) bySection.splice(at, 1);
    }
    if (byClass) {
      const at = byClass.indexOf(student);
      if (at !== -1) byClass.splice(at, 1);
    }
  }

  /** Add a record to both grouping indexes. */
  function groupStudent(student) {
    STUDENTS_BY_SECTION[student.sectionId].push(student);
    STUDENTS_BY_CLASS[student.className].push(student);
  }

  /** Keep the exported totals object in step with STUDENTS.length. */
  function syncTotals() {
    const exported = global.SchoolData;
    if (exported && exported.totals) exported.totals.students = STUDENTS.length;
  }

  /**
   * Attendance percentage for a record that has no generated one.
   *
   * The seed sets `attendance` at random; a record typed into the Add Student
   * form has to earn its figure the same way the rest of the app measures
   * attendance — by asking attendanceOf() for real school days and applying
   * summariseAttendance()'s present + late rule. Last 30 school days, so the
   * number is stable rather than swinging with a short month.
   */
  function deriveAttendance(student) {
    const days = [];
    const cursor = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    let guard = 0;
    while (days.length < 30 && guard < 200) {
      if (cursor.getDay() !== 5) days.push(dateKey(cursor));   // 5 === Friday
      cursor.setDate(cursor.getDate() - 1);
      guard++;
    }
    let attended = 0;
    days.forEach(function (day) {
      const status = attendanceOf(student, day);
      if (status === 'Present' || status === 'Late') attended++;
    });
    return days.length ? Math.round((attended / days.length) * 1000) / 10 : 0;
  }

  /** Next free STU-#### / GR-####-#### number, ignoring deleted records. */
  function nextStudentNumber() {
    let highest = 0;
    STUDENTS.forEach(function (student) {
      const digits = String(student.id).replace(/\D/g, '');
      if (digits) highest = Math.max(highest, Number(digits));
    });
    return highest + 1;
  }

  /** Roll number uniqueness, scoped to one class + section pair. */
  function isRollNoTaken(className, sectionName, rollNo, exceptId) {
    const roster = STUDENTS_BY_CLASS[className] || [];
    return roster.some(function (student) {
      if (student.id === exceptId) return false;
      if (student.sectionName !== sectionName) return false;
      return Number(student.rollNo) === Number(rollNo);
    });
  }

  /** The next free roll number in a section (used to pre-fill the form). */
  function nextRollNo(sectionId) {
    const roster = STUDENTS_BY_SECTION[sectionId] || [];
    const highest = roster.reduce(function (max, student) {
      return Math.max(max, Number(student.rollNo) || 0);
    }, 0);
    return highest + 1;
  }

  function resolveSection(className, sectionName) {
    return SECTIONS.filter(function (section) {
      return section.className === className && section.sectionName === sectionName;
    })[0] || null;
  }

  /** Trim, collapse runs of spaces, and drop a trailing separator. */
  function tidy(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-.,']+|[\s\-.,']+$/g, '');
  }

  helpers.nextStudentNumber = nextStudentNumber;
  helpers.nextRollNo = nextRollNo;
  helpers.isRollNoTaken = isRollNoTaken;
  helpers.recountStudents = recountSectionsAndClasses;

  /**
   * Add a student. `input` carries the form values; everything the seed would
   * otherwise have supplied (id, dates, blood group, transport, fee ledger,
   * attendance) is derived here so the record is indistinguishable from a
   * generated one to every other module.
   *
   * Throws on a duplicate roll number rather than silently accepting it — the
   * form validates first, so a throw means the page skipped validation.
   */
  helpers.addStudent = function (input) {
    const values = input || {};
    const className = values.className;
    const sectionName = values.sectionName;
    const section = resolveSection(className, sectionName);
    if (!section) throw new Error('Unknown class / section: ' + className + ' - ' + sectionName);

    const rollNo = Number(values.rollNo);
    if (isRollNoTaken(className, sectionName, rollNo, null)) {
      throw new Error('Roll number ' + rollNo + ' is already used in ' + section.label);
    }

    const serial = nextStudentNumber();
    const klass = section.classId ? CLASSES.filter(function (item) {
      return item.id === section.classId;
    })[0] : CLASSES.filter(function (item) { return item.name === className; })[0];
    const classAge = klass ? klass.age : 6;
    const gender = values.gender === 'Female' ? 'Female' : 'Male';

    const name = tidy(values.name);
    const parts = name.split(' ');
    const student = {
      id: 'STU-' + pad(serial, 4),
      grNo: 'GR-' + SESSION_START_YEAR + '-' + pad(serial, 4),
      name: name,
      firstName: parts[0] || name,
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
      gender: gender,
      className: className,
      classId: section.classId,
      sectionName: sectionName,
      sectionId: section.id,
      rollNo: rollNo,
      age: classAge,
      dateOfBirth: isoDate(dateOfBirthForAge(classAge)),
      admissionDate: isoDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())),
      guardian: tidy(values.guardian),
      guardianRelation: values.guardianRelation || 'Guardian',
      phone: tidy(values.phone),
      address: tidy(values.address) || fakeAddress(),
      attendance: 0,
      feeStatus: values.feeStatus || 'Pending',
      status: values.status || 'Active',
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-', 'AB-']),
      transport: 'No'
    };

    applyFeeLedger(student);
    student.attendance = deriveAttendance(student);

    STUDENTS.push(student);
    STUDENT_INDEX[student.id] = student;
    groupStudent(student);
    recountSectionsAndClasses();
    syncTotals();
    return student;
  };

  /**
   * Patch an existing record in place.
   *
   * Only the fields a form can own are accepted; id, grNo and the fee ledger
   * are derived and are ignored if passed. Moving a student between sections
   * regroups both indexes and re-derives the ledger, because the fee structure
   * belongs to the class, not the record.
   */
  helpers.updateStudent = function (studentId, patch) {
    const student = STUDENT_INDEX[studentId];
    if (!student) return null;
    const values = patch || {};

    /* Resolve and check the destination *before* writing anything, so a bad
       class / section pair or a colliding roll number cannot leave a record
       half-edited. The roll number is checked in its new home, where the old
       section's numbers no longer conflict with it. */
    const targetClass = values.className !== undefined ? values.className : student.className;
    const targetSection = values.sectionName !== undefined ? values.sectionName : student.sectionName;
    const section = resolveSection(targetClass, targetSection);
    if (!section) throw new Error('Unknown class / section: ' + targetClass + ' - ' + targetSection);

    const rollNo = values.rollNo !== undefined ? Number(values.rollNo) : Number(student.rollNo);
    if (isRollNoTaken(targetClass, targetSection, rollNo, student.id)) {
      throw new Error('Roll number ' + rollNo + ' is already used in ' + section.label);
    }

    const previousClass = student.className;
    const previousSection = student.sectionId;
    const movedSection = section.id !== previousSection;
    const changedClass = targetClass !== previousClass;

    const editable = ['name', 'gender', 'className', 'sectionName', 'rollNo',
      'guardian', 'guardianRelation', 'phone', 'address', 'status', 'feeStatus', 'transport'];

    editable.forEach(function (key) {
      if (values[key] === undefined) return;
      if (key === 'name' || key === 'guardian' || key === 'address') {
        student[key] = tidy(values[key]);
      } else if (key === 'rollNo') {
        student.rollNo = Number(values.rollNo);
      } else if (key === 'gender') {
        student.gender = values.gender === 'Female' ? 'Female' : 'Male';
      } else {
        student[key] = values[key];
      }
    });

    if (movedSection || changedClass) {
      student.sectionId = section.id;
      student.classId = section.classId;
      ungroupStudent(student, previousSection, previousClass);
      groupStudent(student);
    }
    /* The fee structure belongs to the class, so only a class change restates
       the ledger. Moving section within the same class must not rewrite what
       the family has already paid. */
    if (changedClass) applyFeeLedger(student);

    /* firstName / lastName are derived from the full name everywhere else. */
    const parts = String(student.name).split(' ');
    student.firstName = parts[0] || student.name;
    student.lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

    recountSectionsAndClasses();
    return student;
  };

  /**
   * Remove a student and every trace of them from the derived indexes.
   * The caller is responsible for re-rendering; this layer only keeps itself
   * internally consistent.
   */
  helpers.removeStudent = function (studentId) {
    const student = STUDENT_INDEX[studentId];
    if (!student) return false;
    const at = STUDENTS.indexOf(student);
    if (at !== -1) STUDENTS.splice(at, 1);
    delete STUDENT_INDEX[studentId];
    ungroupStudent(student, student.sectionId, student.className);
    recountSectionsAndClasses();
    syncTotals();
    return true;
  };

  /* =========================================================================
   * 17b. TEACHER RECORD MUTATIONS
   *    Mirror the student mutation API so the teachers page can add / edit /
   *    delete without duplicating logic. Every write keeps the denormalised
   *    indexes (assignedClassSections, classTeacherOf, section rosters) in
   *    step so the register, the dashboard and the class summaries all agree.
   * ======================================================================= */

  /** Map teacher id -> record object (not array index, so a splice can't drift). */
  const TEACHER_INDEX = {};
  TEACHERS.forEach(function (teacher) { TEACHER_INDEX[teacher.id] = teacher; });

  function getTeacherById(id) {
    return TEACHER_INDEX[id] || null;
  }

  /**
   * Check whether a (class, section, subject) triple is already taught by
   * another teacher. Returns the conflicting teacher or null.
   * If `excludingId` is given, that teacher is allowed to hold the slot
   * (used when editing an existing assignment).
   */
  function isAssignmentTaken(className, sectionName, subject, excludingId) {
    const sectionId = className + '-' + sectionName;
    const section = SECTIONS.find(function (s) { return s.id === sectionId; });
    if (!section) return null;
    const entry = section.roster.find(function (e) {
      return e.subjects.indexOf(subject) !== -1
        && e.teacherId !== excludingId;
    });
    return entry ? getTeacherById(entry.teacherId) : null;
  }

  /**
   * Check whether a teacher is already the class teacher of a different
   * section. A teacher can be class teacher of at most one section.
   */
  function isClassTeacherOfAnother(teacherId, sectionId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return null;
    return teacher.classTeacherOf.find(function (s) { return s !== sectionId; }) || null;
  }

  /**
   * Rebuild a teacher's denormalised fields from the section rosters.
   * Called after any write that moves assignments.
   */
  function recountTeacher(teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return;
    teacher.assignedClassSections = [];
    teacher.classTeacherOf = [];
    teacher.subjects = [];
    teacher.sectionCount = 0;

    SECTIONS.forEach(function (section) {
      const entry = section.roster.find(function (e) { return e.teacherId === teacherId; });
      if (entry) {
        entry.subjects.forEach(function (subject) {
          teacher.assignedClassSections.push(section.label + ' · ' + subject);
          if (teacher.subjects.indexOf(subject) === -1) teacher.subjects.push(subject);
        });
        teacher.sectionCount++;
        if (section.classTeacherId === teacherId) {
          teacher.classTeacherOf.push(section.id + ' (class teacher)');
        }
      }
    });
  }

  /** Rebuild all teachers' denormalised fields. */
  function recountAllTeachers() {
    TEACHERS.forEach(function (t) { recountTeacher(t.id); });
  }

  /** Next auto-increment staff number (TCH-XXX). */
  function nextTeacherNumber() {
    const max = TEACHERS.reduce(function (m, t) {
      const n = parseInt(t.id.split('-')[1], 10);
      return n > m ? n : m;
    }, 0);
    return 'TCH-' + String(max + 1).padStart(3, '0');
  }

  /**
   * Add a teacher. `input` carries the form values; everything else is
   * derived so the record is indistinguishable from a seeded one.
   * Returns the created teacher object.
   */
  helpers.addTeacher = function (input) {
    const values = input || {};
    const teacher = {
      id: values.id || nextTeacherNumber(),
      staffId: values.staffId || 'STF-' + String(TEACHERS.length + 1).padStart(3, '0'),
      name: values.name,
      firstName: values.name.split(' ')[0],
      lastName: values.name.split(' ').slice(1).join(' ') || '',
      gender: values.gender,
      mainSubject: values.mainSubject,
      canTeach: Array.isArray(values.canTeach) ? values.canTeach.slice() : [values.mainSubject],
      qualification: values.qualification || 'M.Ed',
      experience: Number(values.experience) || 0,
      designation: values.designation || 'Teacher',
      phone: values.phone,
      email: values.email || (values.name.toLowerCase().replace(/[^a-z]/g, '.') + '@motherslapschool.edu.pk'),
      joiningDate: values.joiningDate || isoDate(new Date()),
      address: values.address || '',
      assignedClassSections: [],
      sectionCount: 0,
      classTeacherOf: [],
      subjects: [],
      status: values.status || 'Active'
    };
    TEACHERS.push(teacher);
    TEACHER_INDEX[teacher.id] = teacher;
    recountAllTeachers();
    syncTotals();
    return teacher;
  };

  /**
   * Update a teacher. Only the provided fields are changed; everything else
   * stays as-is. Assignment changes (canTeach, assigned sections, class teacher
   * duty) must be done through the section roster, not here — this updates the
   * teacher's core profile only.
   */
  helpers.updateTeacher = function (teacherId, patch) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) throw new Error('Teacher not found: ' + teacherId);

    Object.keys(patch).forEach(function (key) {
      if (key !== 'id' && key !== 'staffId' && patch[key] !== undefined) {
        teacher[key] = patch[key];
      }
    });
    if (patch.firstName || patch.name) {
      teacher.firstName = (teacher.name || '').split(' ')[0];
      teacher.lastName = (teacher.name || '').split(' ').slice(1).join(' ') || '';
    }
    recountAllTeachers();
    syncTotals();
    return teacher;
  };

  /**
   * Remove a teacher and clear their assignments from all section rosters.
   * The caller is responsible for re-rendering; this layer only keeps itself
   * internally consistent.
   */
  helpers.removeTeacher = function (teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return false;

    /* Clear this teacher from every section roster. */
    SECTIONS.forEach(function (section) {
      const idx = section.roster.findIndex(function (e) { return e.teacherId === teacherId; });
      if (idx !== -1) section.roster.splice(idx, 1);
      if (section.classTeacherId === teacherId) {
        section.classTeacherId = null;
        section.classTeacherName = '—';
      }
    });

    const at = TEACHERS.indexOf(teacher);
    if (at !== -1) TEACHERS.splice(at, 1);
    delete TEACHER_INDEX[teacherId];
    recountAllTeachers();
    syncTotals();
    return true;
  };

  /* Expose helpers used by the teachers page. */
  helpers.getTeacherById = getTeacherById;
  helpers.isAssignmentTaken = isAssignmentTaken;
  helpers.isClassTeacherOfAnother = isClassTeacherOfAnother;
  helpers.nextTeacherNumber = nextTeacherNumber;
  helpers.recountTeacher = recountTeacher;
  helpers.recountAllTeachers = recountAllTeachers;
  /** Return the assigned-class-section strings for one teacher. */
  helpers.getTeacherAssignedClasses = function (teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return [];
    return teacher.assignedClassSections || [];
  };
  /** Return the section ids where this teacher is class teacher. */
  helpers.getTeacherClassTeacherOf = function (teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return [];
    return teacher.classTeacherOf || [];
  };

  /* Expose helpers used by the teachers page. */
  helpers.getTeacherById = getTeacherById;
  helpers.isAssignmentTaken = isAssignmentTaken;
  helpers.isClassTeacherOfAnother = isClassTeacherOfAnother;
  helpers.nextTeacherNumber = nextTeacherNumber;
  helpers.recountTeacher = recountTeacher;
  helpers.recountAllTeachers = recountAllTeachers;

  /* =========================================================================
   * 18. DATA SELF-CHECK (runs once per page load, logged in the console)
   * ====================================================================== */

  function runSelfCheck() {
    const checks = [];
    function check(label, passed, detail) {
      checks.push({ check: label, result: passed ? 'PASS' : 'FAIL', detail: detail || '' });
      return passed;
    }

    const sectionTotal = SECTIONS.reduce(function (sum, section) { return sum + section.capacity; }, 0);
    const studentTotal = STUDENTS.length;

    check('Total students = 2000', studentTotal === TOTAL_STUDENTS, 'found ' + studentTotal);
    check('Total teachers = 50', TEACHERS.length === 50, 'found ' + TEACHERS.length);
    check('Sum of section sizes = 2000', sectionTotal === TOTAL_STUDENTS, 'found ' + sectionTotal);
    check('Classes = 13', CLASSES.length === 13, 'found ' + CLASSES.length);
    check('Sections = 52 (4 per class)', SECTIONS.length === 52, 'found ' + SECTIONS.length);
    check('Subjects = 15', SUBJECTS.length === 15, 'found ' + SUBJECTS.length);

    const sizeIssues = SECTIONS.filter(function (section) {
      return section.capacity < MIN_SECTION_SIZE || section.capacity > MAX_SECTION_SIZE;
    });
    check('Every section holds 30-40 students', sizeIssues.length === 0,
      sizeIssues.length ? sizeIssues.map(function (s) { return s.id; }).join(', ') : 'min ' + MIN_SECTION_SIZE + ' / max ' + MAX_SECTION_SIZE);

    const idSet = new Set(STUDENTS.map(function (student) { return student.id; }));
    check('Student ids unique', idSet.size === studentTotal, idSet.size + ' of ' + studentTotal);

    const grSet = new Set(STUDENTS.map(function (student) { return student.grNo; }));
    check('GR numbers unique', grSet.size === studentTotal, grSet.size + ' of ' + studentTotal);

    const rollIssues = [];
    SECTIONS.forEach(function (section) {
      const rolls = STUDENTS_BY_SECTION[section.id].map(function (student) { return student.rollNo; });
      if (rolls.length !== section.capacity) {
        rollIssues.push(section.id + ' count mismatch (' + rolls.length + '/' + section.capacity + ')');
      } else if (new Set(rolls).size !== rolls.length) {
        rollIssues.push(section.id + ' duplicate roll number');
      }
    });
    check('Roll numbers unique per section', rollIssues.length === 0, rollIssues.join('; '));

    const missingClassTeacher = SECTIONS.filter(function (section) { return !section.classTeacherId; });
    check('Every section has a class teacher', missingClassTeacher.length === 0,
      missingClassTeacher.map(function (s) { return s.id; }).join(', '));

    const doubleBooked = [];
    const subjectGaps = [];
    SECTIONS.forEach(function (section) {
      const seenTeacher = {};
      const seenSubject = {};
      section.roster.forEach(function (entry) {
        if (seenTeacher[entry.teacherId]) {
          doubleBooked.push(section.id + ' / ' + entry.teacherId);
        }
        seenTeacher[entry.teacherId] = true;
        entry.subjects.forEach(function (subject) {
          if (seenSubject[subject]) {
            doubleBooked.push(section.id + ' subject ' + subject + ' booked twice');
          }
          seenSubject[subject] = true;
        });
      });
      section.subjects.forEach(function (subject) {
        if (!seenSubject[subject]) subjectGaps.push(section.id + ' / ' + subject);
      });
    });
    check('No teacher double-booked in a section', doubleBooked.length === 0, doubleBooked.join('; '));
    check('Every class-subject has a teacher', subjectGaps.length === 0, subjectGaps.join('; '));

    const senior = ['Physics', 'Chemistry', 'Biology', 'Pakistan Studies'];
    const seniorLeak = [];
    CLASSES.forEach(function (klass) {
      klass.subjects.forEach(function (subject) {
        if (senior.indexOf(subject) !== -1 && klass.stage !== 'Middle' && klass.stage !== 'Secondary') {
          seniorLeak.push(klass.name + ' / ' + subject);
        }
      });
    });
    check('Senior subjects only in Grade 6-10', seniorLeak.length === 0, seniorLeak.join('; '));

    const feeIssues = CLASSES.filter(function (klass) { return !FEE_STRUCTURE_BY_CLASS[klass.name]; });
    check('Fee structure defined for all 13 classes', feeIssues.length === 0, feeIssues.length + ' missing');

    const phonePattern = /^03\d{2}-\d{7}$/;
    const badPhones = STUDENTS.filter(function (student) { return !phonePattern.test(student.phone); }).length
      + TEACHERS.filter(function (teacher) { return !phonePattern.test(teacher.phone); }).length;
    check('All phone numbers use 03XX-XXXXXXX', badPhones === 0, badPhones + ' malformed');

    const duplicates = TEACHERS.map(function (teacher) { return teacher.id; })
      .filter(function (id, index, list) { return list.indexOf(id) !== index; });
    check('Teacher ids unique', duplicates.length === 0, duplicates.join(', '));

    /* --- Dashboard aggregates (Step 5) ---------------------------------- */

    const gender = helpers.getGenderSummary();
    const stageNames = CLASSES.map(function (klass) { return klass.stage; })
      .filter(function (stage, index, all) { return all.indexOf(stage) === index; });
    const stageTotals = gender.byStage.reduce(function (sum, row) { return sum + row.total; }, 0);
    check('Gender split totals 2,000', gender.school.boys + gender.school.girls === TOTAL_STUDENTS,
      gender.school.boys + ' boys + ' + gender.school.girls + ' girls');
    check('Gender split by stage and class reconciles with the school total',
      gender.byStage.length === stageNames.length && stageTotals === TOTAL_STUDENTS
      && gender.byClass.length === CLASSES.length,
      gender.byStage.map(function (row) { return row.stage + ':' + row.total; }).join(', '));

    const monthly = helpers.getMonthlyFeeSummary();
    check('Monthly fee bill reconciles (billed = collected + pending)',
      monthly.billed === monthly.collected + monthly.pending,
      'Rs ' + monthly.billed + ' = Rs ' + monthly.collected + ' + Rs ' + monthly.pending
      + ' (' + monthly.monthName + ' ' + monthly.monthsElapsed + ' of 12 months)');
    check('Monthly fee bill matches one month of tuition for 2,000 students',
      monthly.billed === CLASSES.reduce(function (sum, klass) {
        return sum + FEE_STRUCTURE_BY_CLASS[klass.name].monthlyTuition * STUDENTS_BY_CLASS[klass.name].length;
      }, 0), 'Rs ' + monthly.billed);
    check('Monthly collection never exceeds the bill',
      monthly.collected <= monthly.billed && monthly.pending >= 0,
      monthly.percent + '% of Rs ' + monthly.billed);

    const trend = helpers.getAttendanceTrend(7);
    const trendOrdered = trend.every(function (day, index) {
      return index === 0 || day.date > trend[index - 1].date;
    });
    const noFriday = trend.every(function (day) {
      return new Date(Number(day.date.slice(0, 4)), Number(day.date.slice(5, 7)) - 1,
        Number(day.date.slice(8, 10))).getDay() !== FRIDAY;
    });
    check('Attendance trend returns 7 ascending school days', trend.length === 7 && trendOrdered && noFriday,
      trend.map(function (day) { return day.date + ' ' + day.percent + '%'; }).join(' | '));
    check('Attendance trend ends on today', trend[trend.length - 1].isToday === true,
      'last day ' + trend[trend.length - 1].date);

    const papers = helpers.getExamPapers({ status: ['Upcoming', 'Scheduled'] });
    const papersInOrder = papers.every(function (paper, index) {
      if (index === 0) return true;
      const previous = papers[index - 1];
      return previous.date < paper.date
        || (previous.date === paper.date && previous.time <= paper.time);
    });
    const badTimes = papers.filter(function (paper) { return !/^\d{2}:\d{2}$/.test(paper.time); });
    check('Exam papers carry subject + class + date + time', papers.length > 0 && badTimes.length === 0,
      papers.length + ' papers, ' + EXAMS.reduce(function (sum, exam) {
        return sum + exam.sittings.length;
      }, 0) + ' sittings');
    check('Exam papers are in date/time order', papersInOrder,
      papers.length ? papers[0].date + ' ' + papers[0].time + ' → ' + papers[papers.length - 1].date
        + ' ' + papers[papers.length - 1].time : 'none');
    const outsideWindow = [];
    EXAMS.forEach(function (exam) {
      exam.sittings.forEach(function (sitting) {
        if (sitting.date < exam.startDate || sitting.date > exam.endDate) {
          outsideWindow.push(exam.id + ' ' + sitting.subject + ' ' + sitting.date);
        }
      });
    });
    check('Every sitting falls inside its exam window', outsideWindow.length === 0, outsideWindow.join('; '));

    const statusIssues = EXAMS.filter(function (exam) {
      if (!exam.inSession) return true;
      const expected = exam.endDate < dateKey(NOW) ? 'Completed' : (exam.startDate <= dateKey(NOW) ? 'Ongoing' : 'Upcoming');
      return exam.status !== expected;
    });
    check('Exam status matches the calendar and sits inside the session', statusIssues.length === 0,
      EXAMS.map(function (exam) { return exam.id + ' ' + exam.status + ' ' + exam.startDate; }).join(' | '));

    const activity = helpers.getRecentActivity(8);
    const activityOrdered = activity.every(function (item, index) {
      return index === 0 || item.date <= activity[index - 1].date;
    });
    check('Recent activity returns at least 6 dated items, newest first',
      activity.length >= 6 && activityOrdered && activity.every(function (item) { return !!item.date; }),
      activity.map(function (item) { return item.kind; }).join(', '));
    /* "Recent" has to mean recent: nothing in the feed may be dated ahead of
       today, or the timeline would list a 2027 exam as something that happened. */
    const future = helpers.getRecentActivity(50).filter(function (item) {
      return item.date > dateKey(NOW);
    });
    check('No activity is dated in the future', future.length === 0,
      future.map(function (item) { return item.date + ' ' + item.title.slice(0, 34); }).join('; ')
      || 'latest ' + helpers.getRecentActivity(50)[0].date);

    const failures = checks.filter(function (item) { return item.result === 'FAIL'; });

    if (global.console && console.group) {
      console.groupCollapsed(
        "%cMother's Lap School System — data self-check%c " + (failures.length ? failures.length + ' issue(s)' : 'all ' + checks.length + ' checks passed'),
        'background:#14396b;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px',
        'background:#e2e8f0;color:#14396b;padding:2px 6px;border-radius:0 3px 3px 0;font-weight:600'
      );
      if (console.table) {
        console.table(checks);
      } else {
        checks.forEach(function (item) { console.log(item.result, item.check, item.detail); });
      }
      if (failures.length === 0) {
        console.log('%c✓ students = ' + studentTotal + '  •  teachers = ' + TEACHERS.length
          + '  •  sum of section sizes = ' + sectionTotal + '  •  sections = ' + SECTIONS.length
          + '  •  subjects = ' + SUBJECTS.length,
        'color:#15803d;font-weight:600');
      } else {
        console.error('%c✗ ' + failures.length + ' data inconsistency/inconsistencies found',
          'color:#b91c1c;font-weight:600');
      }
      console.groupEnd();
    }

    return { checks: checks, failures: failures.length, ok: failures.length === 0 };
  }

  /* =========================================================================
   * 19. EXPORT
   * ====================================================================== */

  global.SchoolData = {
    version: '1.0.0',
    brand: SCHOOL.name,

    /* School profile & session */
    school: SCHOOL,
    session: ACADEMIC_SESSION,
    academicSession: ACADEMIC_SESSION,
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,

    /* Academic structure */
    classes: CLASSES,
    classDefinitions: CLASS_DEFINITIONS,
    sections: SECTIONS,
    sectionLetters: SECTION_LETTERS,
    subjects: SUBJECTS,
    subjectNames: SUBJECT_NAMES,
    curriculum: CURRICULUM,

    /* People */
    students: STUDENTS,
    teachers: TEACHERS,

    /* Money, exams, work */
    fees: FEES,
    feeStructures: FEES.structures,
    exams: EXAMS,
    assignments: ASSIGNMENTS,
    announcements: ANNOUNCEMENTS,

    /* Aggregate helpers */
    totals: {
      students: STUDENTS.length,
      teachers: TEACHERS.length,
      classes: CLASSES.length,
      sections: SECTIONS.length,
      subjects: SUBJECTS.length,
      assignments: ASSIGNMENTS.length,
      exams: EXAMS.length,
      announcements: ANNOUNCEMENTS.length,
      sectionCapacityTotal: SECTIONS.reduce(function (sum, s) { return sum + s.capacity; }, 0)
    },

    helpers: helpers,
    getStudentsByClass: helpers.getStudentsByClass,
    getTeacherById: helpers.getTeacherById,
    getClassSummary: helpers.getClassSummary,
    getFeeSummary: helpers.getFeeSummary,

    runSelfCheck: runSelfCheck
  };

  // Run the self-check once per load (safe to call again manually).
  global.SchoolData.selfCheck = runSelfCheck();

}(window));