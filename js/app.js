/*!
 * js/app.js
 * ---------------------------------------------------------------------------
 * "Mother's Lap School System" — shared application layer.
 *
 * Responsibilities
 *   1. Render the app shell (sidebar, topbar, footer) on every page so the
 *      brand and navigation stay identical everywhere.
 *   2. Provide small, dependency-free helpers: DOM, formatting, storage,
 *      icons, toasts, modals.
 *   3. Provide App.createDataTable() — the paginated / debounced-search /
 *      sortable table used by every list page, so 2,000 student records are
 *      never rendered at once.
 *
 * Depends on: js/data.js (window.SchoolData)
 * Exposes:    window.App
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const App = {};

  /* =========================================================================
   * 0. BOOT GUARD — data.js must load first
   * ====================================================================== */
  const Data = global.SchoolData;
  if (!Data) {
    document.addEventListener('DOMContentLoaded', function () {
      const content = document.querySelector('.content');
      if (content) {
        content.innerHTML = '<div class="alert alert--danger"><div>'
          + '<strong>Data layer missing.</strong> js/data.js did not load, so this page cannot render. '
          + 'Check the script paths at the bottom of this HTML file.</div></div>';
      }
    });
    return;
  }

  /** Root-relative prefix ('' on index.html, '../' inside pages/). */
  App.base = document.body ? (document.body.getAttribute('data-base') || '') : '';
  App.page = document.body ? (document.body.getAttribute('data-page') || '') : '';
  App.helpers = Data.helpers;
  App.brand = Data.school.name;

  /**
   * The signed-in user for this prototype. Declared once here so the sidebar
   * profile and the topbar avatar can never drift apart.
   */
  App.user = {
    name: 'Administrator',
    role: 'Administrator',
    initials: 'AD'
  };

  /* =========================================================================
   * 1. DOM HELPERS
   * ====================================================================== */

  App.qs = function (selector, root) { return (root || document).querySelector(selector); };
  App.qsa = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  /**
   * Create an element.
   * @param {string} tag
   * @param {Object} [attrs] class/text/html/dataset/aria + any attribute
   * @param {Array} [children] nodes or strings
   */
  App.el = function (tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'dataset') {
          Object.keys(value).forEach(function (dataKey) { node.dataset[dataKey] = value[dataKey]; });
        } else if (typeof value === 'function' && key.slice(0, 2) === 'on') {
          /* `onclick: fn` has to become a real listener. An inline handler
           * *attribute* holds source text, so setAttribute() stringified the
           * function into `onclick="function () {...}"` and the handler never
           * fired - which silently turned every App.modal / App.panel footer
           * action into a dead button. A string still falls through to the
           * attribute path below, so nothing relying on that changes. */
          node.addEventListener(key.slice(2), value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  };

  App.frag = function (children) {
    const fragment = document.createDocumentFragment();
    (children || []).forEach(function (child) {
      if (!child) return;
      fragment.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return fragment;
  };

  App.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); };

  App.escapeHtml = function (value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /** Debounce — used for every search box (keeps typing cheap on 2,000 rows). */
  App.debounce = function (fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const context = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, wait || 250);
    };
  };

  /* =========================================================================
   * 2. FORMATTING HELPERS (delegate to the data layer)
   * ====================================================================== */
  const fmt = {
    currency: function (value) { return App.helpers.formatPKR(value); },
    number: function (value) { return App.helpers.formatNumber(value); },
    date: function (iso, style) { return App.helpers.formatDate(iso, style); },
    phone: function (phone) { return App.helpers.formatPhone(phone); },
    initials: function (name) { return App.helpers.initials(name); },
    percent: function (value) { return Number(value || 0).toFixed(1) + '%'; },
    grade: function (value) {
      const n = Number(value) || 0;
      return n + '%';
    }
  };
  App.format = fmt;

  /** Status text -> badge modifier class (one shared visual language). */
  App.badgeClass = function (status) {
    const map = {
      'Paid': 'badge--success', 'Active': 'badge--success', 'Present': 'badge--success',
      'Completed': 'badge--success', 'Graded': 'badge--success', 'Active ': 'badge--success',
      'Pending': 'badge--warning', 'Partial': 'badge--warning', 'On Leave': 'badge--warning',
      'Leave': 'badge--warning', 'Late': 'badge--warning', 'Scheduled': 'badge--info',
      'Upcoming': 'badge--info', 'Submitted': 'badge--info', 'Normal': 'badge--info',
      'Ongoing': 'badge--info',
      'Overdue': 'badge--danger', 'Absent': 'badge--danger', 'Left': 'badge--danger',
      'Urgent': 'badge--danger', 'Inactive': 'badge--danger',
      'Important': 'badge--purple', 'Female': 'badge--purple'
    };
    return map[status] || 'badge--info';
  };

  /** Build a badge element. */
  App.badge = function (text, variant) {
    const modifier = variant || App.badgeClass(text);
    return App.el('span', { class: 'badge ' + modifier, text: text === undefined ? '—' : String(text) });
  };

  App.emptyState = function (options) {
    const opts = options || {};
    return App.el('div', { class: 'empty-state' }, [
      App.el('div', { class: 'empty-state__icon', html: App.icon(opts.icon || 'inbox', 'icon--lg') }),
      App.el('p', { class: 'empty-state__title', text: opts.title || 'Nothing to show' }),
      App.el('p', { text: opts.message || 'Try changing the filters or the search term.' })
    ]);
  };

  /* =========================================================================
   * 3. ICONS (inline SVG — works from file:// without extra requests)
   * ====================================================================== */
  const ICONS = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM13 7h8V3h-8zM3 21h8v-4H3z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    'user-plus': '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    school: '<path d="m12 3 10 5-10 5L2 8l10-5Z"/><path d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5M22 8v6"/>',
    clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><circle cx="16.5" cy="13" r="1.2"/>',
    megaphone: '<path d="m3 11 15-6v14L3 13v-2Z"/><path d="M6.5 13.5V17a2 2 0 0 0 4 0v-2M21 10v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 15.6l1-4 9.4-9Z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    chart: '<path d="M3 21h18M6 21V11M11 21V4M16 21v-7M21 21V8"/>',
    inbox: '<path d="m3 12 2.5-7h13L21 12"/><path d="M3 12h4l2 3h6l2-3h4v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3.2-6.9"/><path d="M21 4v5h-5"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.5l6.3-.9L12 3Z"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"/><path d="M14 2v5h5M9 13h6M9 17h4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    'external': '<path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M8 21v-6h8v6M8 3v4h6"/>'
  };

  /** Returns an inline SVG string for the given icon name. */
  App.icon = function (name, className) {
    const body = ICONS[name] || ICONS.info;
    return '<svg class="icon ' + (className || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
      + body + '</svg>';
  };

  /** Icon as a real DOM node. */
  App.iconNode = function (name, className) {
    const wrap = document.createElement('span');
    wrap.innerHTML = App.icon(name, className);
    return wrap.firstChild;
  };

  /* =========================================================================
   * 4. STORAGE (settings persist per browser, demo only)
   * ====================================================================== */
  const STORAGE_PREFIX = 'mls.';   // Mother's Lap School
  App.storage = {
    get: function (key, fallback) {
      try {
        const raw = global.localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) { return fallback; }
    },
    set: function (key, value) {
      try { global.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); return true; }
      catch (error) { return false; }
    },
    remove: function (key) {
      try { global.localStorage.removeItem(STORAGE_PREFIX + key); } catch (error) { /* ignore */ }
    }
  };

  /* =========================================================================
   * 5. TOASTS & MODALS
   * ====================================================================== */
  App.toast = function (message, type, duration) {
    const region = App.qs('#toast-region');
    if (!region) return;
    const node = App.el('div', { class: 'toast' + (type ? ' toast--' + type : ''), role: 'status' }, [
      /* `check-circle` is not in ICONS, so every success toast used to fall back
         to the info glyph. `check` is the real one. */
      App.iconNode(type === 'error' ? 'alert' : (type === 'success' ? 'check' : 'info'), 'icon--sm'),
      App.el('span', { text: message })
    ]);
    region.appendChild(node);
    setTimeout(function () { node.remove(); }, duration || 3200);
  };

  /* -------------------------------------------------------------------------
   * Scroll lock — reference counted.
   *
   * The modal and the side panel each lock the page behind them. A bare
   * `body.style.overflow = ''` in whichever one closes last would release the
   * page while the *other* is still open, so holds are counted instead.
   * `App.sidebar` uses the same two functions, so the three can nest.
   * ---------------------------------------------------------------------- */
  let scrollLockHolds = 0;
  function lockScroll() {
    scrollLockHolds++;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    scrollLockHolds = Math.max(0, scrollLockHolds - 1);
    if (!scrollLockHolds) document.body.style.overflow = '';
  }
  App.isScrollLocked = function () { return scrollLockHolds > 0; };

  /** Open the shared modal (created on demand). */
  App.modal = function (options) {
    const opts = options || {};
    let modal = App.qs('#app-modal');
    if (!modal) {
      modal = App.el('div', {
        id: 'app-modal', class: 'modal', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'app-modal-title', tabindex: '-1'
      }, [
        App.el('div', { class: 'modal__dialog' }, [
          App.el('div', { class: 'modal__header' }, [
            App.el('h2', { class: 'modal__title', id: 'app-modal-title', text: '' }),
            App.el('button', {
              class: 'modal__close', type: 'button', 'aria-label': 'Close dialog',
              html: App.icon('close')
            })
          ]),
          App.el('div', { class: 'modal__body', id: 'app-modal-body' }),
          App.el('div', { class: 'modal__footer', id: 'app-modal-footer' })
        ])
      ]);
      document.body.appendChild(modal);
      modal.querySelector('.modal__close').addEventListener('click', function () { App.closeModal(); });
      modal.addEventListener('mousedown', function (event) {
        if (event.target === modal) App.closeModal();
      });
    }
    modal.querySelector('.modal__title').textContent = opts.title || 'Details';
    const body = modal.querySelector('#app-modal-body');
    App.clear(body);
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content) body.appendChild(opts.content);

    /* Footer is created lazily — dialogs without actions need no footer. */
    let footer = modal.querySelector('#app-modal-footer');
    const actions = opts.actions || [];
    modal._actionButtons = [];
    if (actions.length) {
      if (!footer) {
        footer = App.el('div', { class: 'modal__footer', id: 'app-modal-footer' });
        modal.querySelector('.modal__dialog').appendChild(footer);
      }
      App.clear(footer);
      modal._actionButtons = actions.map(function (action) {
        const button = App.el('button', {
          class: 'btn ' + (action.variant ? 'btn--' + action.variant : 'btn--ghost'),
          type: 'button', text: action.label,
          onclick: action.onClick
        });
        /* A form's submit action starts disabled and is enabled by its own
           validity pass, so the action spec has to be able to say "not yet". */
        if (action.disabled) button.disabled = true;
        footer.appendChild(button);
        return button;
      });
    } else if (footer) {
      footer.remove();
    }

    /* Captured before the focus move below, or it would record the dialog's own
       close button as the return target and never go back to the trigger. */
    modal._returnFocus = document.activeElement;

    modal.classList.add('is-open');
    if (!modal.classList.contains('was-open')) lockScroll();
    modal.classList.add('was-open');
    const focusTarget = opts.initialFocus
      ? modal.querySelector(opts.initialFocus)
      : modal.querySelector('.modal__close');
    if (focusTarget) focusTarget.focus();
    return modal;
  };

  App.closeModal = function () {
    const modal = App.qs('#app-modal');
    if (!modal) return;
    if (modal.classList.contains('is-open')) unlockScroll();
    modal.classList.remove('is-open', 'was-open');
    /* `.modal` is display:none while closed, so the dialog is already out of the
       tab order and the accessibility tree. What matters is putting the reader
       back where they were — unless the trigger has since been re-rendered, in
       which case focus falls back to the page landmark, as closePanel does. */
    const target = modal._returnFocus;
    modal._returnFocus = null;
    if (target && target.isConnected && target.focus) target.focus();
    else {
      const main = App.qs('#main-content');
      if (main) main.focus();
    }
  };

  /** True while a modal is showing — used by the Escape and Tab handlers. */
  App.isModalOpen = function () {
    const modal = App.qs('#app-modal');
    return !!(modal && modal.classList.contains('is-open'));
  };

  /* -------------------------------------------------------------------------
   * CONFIRMATION DIALOG
   *
   * Destructive actions need a stop. This is the shared version so every page
   * asks the same way and gets the same keyboard behaviour for free: Escape and
   * the overlay both cancel, focus lands on Cancel (so a stray Enter does not
   * delete anything), and the confirming button is the variant the caller asks
   * for rather than the default.
   * ---------------------------------------------------------------------- */
  App.confirm = function (options) {
    const opts = options || {};
    return App.modal({
      title: opts.title || 'Please confirm',
      content: App.el('div', { class: 'stack' }, [
        App.el('p', { class: 'modal__message', text: opts.message || '' }),
        opts.note ? App.el('p', { class: 'modal__note', text: opts.note }) : null
      ].filter(Boolean)),
      initialFocus: '#app-modal-footer .btn:first-child',
      actions: [
        { label: opts.cancelLabel || 'Cancel', variant: 'ghost', onClick: App.closeModal },
        {
          label: opts.confirmLabel || 'Confirm',
          variant: opts.variant || 'danger',
          onClick: function () {
            /* The handler runs first so it can veto: returning false leaves the
               dialog up, which is how a failed write stays on screen. It also
               matters for ordering — a confirm raised from a table row is about
               to have that row re-rendered away, so closing afterwards lets
               closeModal see the trigger is already detached and put focus on
               the page landmark instead of a dead node. */
            if (opts.onConfirm && opts.onConfirm() === false) return;
            App.closeModal();
          }
        }
      ]
    });
  };

  /* -------------------------------------------------------------------------
   * VALIDATORS
   *
   * Every validator is a factory returning `(value, allValues) => message | ''`.
   *
   * Two decisions worth stating. Returning the *message* rather than a boolean
   * is what lets a field explain itself instead of just turning red. Taking
   * `allValues` as a second argument is what lets a rule look at its
   * neighbours — "roll 41 is already used in Grade 5 A" depends on the class and
   * section selects as well as the roll number, so it cannot be a format rule.
   *
   * The pipeline is `App.validators.compose(...)`, so a field lists its rules
   * and the first failure wins. That keeps each rule ignorant of the others.
   * ---------------------------------------------------------------------- */
  App.validators = {
    required: function (label) {
      return function (value) {
        const text = value === undefined || value === null ? '' : String(value).trim();
        return text === '' ? (label ? label + ' is required' : 'This field is required') : '';
      };
    },

    /**
     * Letters only, plus the punctuation real names carry: a hyphen in
     * "Anne-Marie", an apostrophe in "O'Brien", a full stop in "J. Smith".
     * Digits and symbols are what this exists to reject.
     *
     * `\p{L}` rather than `[A-Za-z]` so a name in a non-Latin script is not
     * rejected for being a name. The value is trimmed first, so the pattern
     * never has to worry about a leading or trailing space.
     */
    lettersOnly: function (label) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        return /^[\p{L}][\p{L} .'-]*$/u.test(text)
          ? ''
          : (label || 'This field') + ' may contain letters only — spaces, hyphens and apostrophes are fine';
      };
    },

    digitsOnly: function (label) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        return /^\d+$/.test(text) ? '' : (label || 'This field') + ' must be digits only';
      };
    },

    /** Pakistani mobile numbers, always written 03XX-XXXXXXX. */
    phone: function (label) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        return /^03\d{2}-\d{7}$/.test(text)
          ? ''
          : (label || 'Phone') + ' must be written as 03XX-XXXXXXX, for example 0300-1234567';
      };
    },

    minLength: function (count, message) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        return text.length >= count
          ? ''
          : (message || 'Please enter at least ' + count + ' characters');
      };
    },

    range: function (min, max, message) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        const between = 'Enter a number between ' + min + ' and ' + max;
        const number = Number(text);
        if (Number.isNaN(number)) return message || between;
        return number >= min && number <= max ? '' : (message || between);
      };
    },

    /** Anything else: a predicate, or a raw pattern. */
    matches: function (pattern, message) {
      return function (value) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') return '';
        const test = pattern instanceof RegExp ? pattern.test(text) : pattern(text);
        return test ? '' : (message || 'That value is not valid');
      };
    },

    /** Cross-field / cross-record rule. `test` returns a message or ''. */
    custom: function (test) {
      return function (value, allValues) { return test(value, allValues) || ''; };
    },

    /** Run rules in order; the first message wins. */
    compose: function () {
      const rules = Array.prototype.slice.call(arguments).filter(Boolean);
      return function (value, allValues) {
        for (let i = 0; i < rules.length; i++) {
          const message = rules[i](value, allValues);
          if (message) return message;
        }
        return '';
      };
    }
  };

  /* -------------------------------------------------------------------------
   * FORM FIELD
   *
   * Builds label + control + hint + error slot and returns a small control
   * object. The error slot is always in the DOM and referenced by
   * `aria-describedby` from the start; `.field__error` is `display: none`
   * until `.field.is-invalid` turns it on, so a field that has never been
   * wrong is silent without its hint being orphaned from the description.
   *
   * @param {Object} opts
   * @param {string}  opts.name           field name, used for the value bag
   * @param {string}  opts.label          visible label
   * @param {string}  [opts.id]
   * @param {string}  [opts.type]         input type (default text)
   * @param {string}  [opts.hint]         helper text under the control
   * @param {Array}   [opts.options]      select options, or a fn(allValues)
   * @param {*}       [opts.value]
   * @param {boolean} [opts.required]     shows the * marker and adds the rule
   * @param {function} [opts.rules]       (value, allValues) => message | ''
   * @param {boolean} [opts.full]         span the full form-grid row
   * @param {boolean} [opts.dynamic]      re-fill options when other fields change
   * @returns {{node:HTMLElement, input:HTMLElement, name:string,
   *            isSelect:boolean, dynamic:boolean,
   *            getValue:function, setValue:function, setError:function,
   *            refreshOptions:function}}
   */
  App.formField = function (options) {
    const opts = options || {};
    const name = opts.name;
    const id = opts.id || ('f-' + name);
    const hintId = id + '-hint';
    const errorId = id + '-error';
    const labelText = opts.label || name;

    let input;
    let select = !!opts.options;

    function fillOptions(target, list, selected) {
      App.clear(target);
      (list || []).forEach(function (option) {
        target.appendChild(App.el('option', {
          value: option.value,
          text: option.label,
          selected: String(option.value) === String(selected)
        }));
      });
    }

    if (select) {
      input = App.el('select', { class: 'select', id: id, name: name });
      fillOptions(input, resolveOptions(opts.options, {}), opts.value);
    } else {
      input = App.el('input', {
        class: 'input', id: id, name: name,
        type: opts.type || 'text',
        inputmode: opts.inputmode,
        placeholder: opts.placeholder,
        autocomplete: opts.autocomplete || 'off',
        maxlength: opts.maxlength,
        value: opts.value === undefined || opts.value === null ? '' : opts.value
      });
    }

    const label = App.el('label', { class: 'field__label', for: id }, [
      document.createTextNode(labelText),
      opts.required ? App.el('span', {
        class: 'field__required', 'aria-hidden': 'true', text: '*'
      }) : null
    ].filter(Boolean));

    const hint = opts.hint ? App.el('span', { class: 'field__hint', id: hintId, text: opts.hint }) : null;
    const error = App.el('span', { class: 'field__error', id: errorId, role: 'alert' });

    input.setAttribute('aria-describedby', (hint ? hintId + ' ' : '') + errorId);

    const node = App.el('div', { class: 'field' + (opts.full ? ' full' : '') }, [
      label, input, hint, error
    ].filter(Boolean));

    function currentValue() {
      return select ? input.value : input.value.trim();
    }

    function setValue(value) {
      input.value = value === undefined || value === null ? '' : String(value);
    }

    function setError(message) {
      const text = message || '';
      error.textContent = text;
      if (text) {
        node.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
      } else {
        node.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
      }
      return text;
    }

    return {
      node: node,
      input: input,
      name: name,
      isSelect: select,
      dynamic: !!opts.dynamic,
      getValue: currentValue,
      setValue: setValue,
      setError: setError,
      /** Re-fill a select's options from the current value bag. */
      refreshOptions: function (allValues) {
        if (!select) return;
        const previous = input.value;
        fillOptions(input, resolveOptions(opts.options, allValues), previous);
        /* Keep the old value if the new option list still offers it,
           otherwise fall to the first option (or blank, if the list is empty). */
        const stillThere = App.qsa('option', input).some(function (option) {
          return option.value === previous;
        });
        input.value = stillThere ? previous : (input.options[0] ? input.options[0].value : '');
      }
    };
  };

  function resolveOptions(options, allValues) {
    return typeof options === 'function' ? options(allValues) : (options || []);
  }

  /* -------------------------------------------------------------------------
   * FORM MODAL
   *
   * `App.modal` plus the behaviour every record form needs and none of them
   * should re-implement:
   *
   *   - inline errors per field, and `aria-invalid` / `aria-describedby` wiring
   *   - the submit action disabled whenever the form is invalid
   *   - Enter submits
   *   - a select whose options depend on other fields (class -> section)
   *   - Escape and overlay-click close, focus returned to the trigger
   *
   * Errors appear only once a field has been *touched* (blurred, or edited).
   * Validity is computed from the start, so the submit button is honest
   * immediately, but a pristine dialog does not open shouting about six empty
   * required fields.
   * ---------------------------------------------------------------------- */
  App.formModal = function (options) {
    const opts = options || {};
    const fields = opts.fields || [];
    const controls = [];
    const touched = {};

    function values() {
      const bag = {};
      controls.forEach(function (control) { bag[control.name] = control.getValue(); });
      return bag;
    }

    const form = App.el('form', {
      class: opts.gridClass || 'form-grid',
      novalidate: true
    });

    fields.forEach(function (spec) {
      const control = App.formField({
        id: spec.id,
        name: spec.name,
        label: spec.label,
        type: spec.type,
        hint: spec.hint,
        options: spec.options,
        value: spec.value,
        required: spec.required,
        maxlength: spec.maxlength,
        placeholder: spec.placeholder,
        inputmode: spec.inputmode,
        autocomplete: spec.autocomplete,
        full: spec.full,
        dynamic: spec.dynamic
      });
      control.validate = spec.rules
        ? function () { return spec.rules(control.getValue(), values()); }
        : function () { return ''; };
      controls.push(control);
      form.appendChild(control.node);
    });

    /* A real submit button, visually hidden: it gives Enter-to-submit its
       native behaviour, which the footer action buttons (type="button") do not. */
    form.appendChild(App.el('button', {
      class: 'sr-only', type: 'submit', tabindex: '-1', text: opts.submitLabel || 'Save'
    }));

    const modal = App.modal({
      title: opts.title,
      content: form,
      initialFocus: controls[0] ? '#' + controls[0].input.id : null,
      actions: [
        { label: opts.cancelLabel || 'Cancel', variant: 'ghost', onClick: App.closeModal },
        {
          label: opts.submitLabel || 'Save',
          variant: opts.variant || 'primary',
          disabled: true,
          onClick: submit
        }
      ]
    });

    /* Aligned with the actions array above, so this is the submit button. */
    const submitButton = modal._actionButtons[1];

    function firstInvalid() {
      for (let i = 0; i < controls.length; i++) {
        if (controls[i].validate()) return controls[i];
      }
      return null;
    }

    /** Enable or disable submit to match the current values. */
    function syncSubmit() {
      if (submitButton) submitButton.disabled = !!firstInvalid();
    }

    function submit() {
      const bag = values();
      let bad = null;
      controls.forEach(function (control) {
        const message = control.validate();
        if (message && !bad) { bad = control; touched[control.name] = true; }
      });
      if (bad) {
        /* Reveal every error at once — they asked to save, so show them all. */
        controls.forEach(function (control) {
          control.setError(control.validate());
          touched[control.name] = true;
        });
        bad.input.focus();
        return;
      }
      try {
        if (opts.onSubmit) opts.onSubmit(bag, controls);
        App.closeModal();
      } catch (error) {
        /* A rule the field list could not know about (a duplicate roll number
           that appeared between validating and saving). Keep the dialog open and
           say why, rather than closing on a failed write. */
        App.toast(error && error.message ? error.message : 'Could not save the record', 'error');
      }
    }

    /* Per-field listeners: edit -> re-validate silently unless already shown. */
    controls.forEach(function (control) {
      const revalidate = function () {
        if (control.dynamic) return;                 /* its options depend on us */
        const message = control.validate();
        if (touched[control.name]) control.setError(message);
        syncSubmit();
      };
      control.input.addEventListener('input', function () {
        revalidate();
        /* A dependent select has to be re-filled from the value bag on every
           keystroke, or it would only catch up on blur. */
        refreshDependents();
      });
      control.input.addEventListener('change', function () {
        revalidate();
        refreshDependents();
      });
      control.input.addEventListener('blur', function () {
        /* Blur marks a field as "the reader has finished with it", which is
           when an error should finally appear. */
        touched[control.name] = true;
        control.setError(control.validate());
        syncSubmit();
      });
    });

    function refreshDependents() {
      const bag = values();
      let optionsChanged = false;
      controls.forEach(function (control) {
        if (!control.dynamic) return;
        const before = control.input.value;
        control.refreshOptions(bag);
        if (control.input.value !== before) optionsChanged = true;
      });
      if (optionsChanged) {
        /* The dependent control's own value changed under the reader, so its
           previous verdict no longer applies. */
        controls.forEach(function (control) {
          if (touched[control.name]) control.setError(control.validate());
        });
        syncSubmit();
      }
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit();
    });

    /* Options may be functions of a bag that does not exist until the controls
       are built, so prime any dependent select once everything is in place. */
    controls.forEach(function (control) { if (control.dynamic) control.refreshOptions(values()); });
    syncSubmit();

    return {
      modal: modal,
      controls: controls,
      close: App.closeModal
    };
  };

  /* -------------------------------------------------------------------------
   * SIDE PANEL — a right-hand drawer for record detail.
   *
   * Same CSS contract as the mobile navigation drawer (`.drawer--right` over a
   * `.drawer__scrim`), but unlike that one it exists at every width: a student
   * profile is worth a panel on a desktop too, where a centred modal would
   * cover the register the reader is comparing against.
   * ---------------------------------------------------------------------- */

  App.panel = function (options) {
    const opts = options || {};
    let panel = App.qs('#app-panel');

    if (!panel) {
      panel = App.el('aside', {
        id: 'app-panel', class: 'drawer drawer--right',
        role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'app-panel-title'
      }, [
        App.el('div', { class: 'drawer__header' }, [
          App.el('h2', { class: 'drawer__title', id: 'app-panel-title', text: '' }),
          App.el('button', {
            class: 'drawer__close modal__close', type: 'button',
            'aria-label': 'Close panel', html: App.icon('close')
          })
        ]),
        App.el('div', { class: 'drawer__body', id: 'app-panel-body' }),
        App.el('div', { class: 'drawer__footer', id: 'app-panel-footer' })
      ]);
      document.body.appendChild(panel);

      /* One scrim shared by every panel, created alongside the first one. */
      if (!App.qs('#app-panel-scrim')) {
        document.body.appendChild(App.el('div', { class: 'drawer__scrim', id: 'app-panel-scrim' }));
      }
      panel.querySelector('.drawer__close').addEventListener('click', App.closePanel);
      App.qs('#app-panel-scrim').addEventListener('click', App.closePanel);
    }

    panel.querySelector('.drawer__title').textContent = opts.title || 'Details';
    const body = panel.querySelector('#app-panel-body');
    App.clear(body);
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content) body.appendChild(opts.content);

    /* The footer is removed when a panel has no actions, so a read-only
       profile does not carry an empty bar. */
    const footer = panel.querySelector('#app-panel-footer');
    const actions = opts.actions || [];
    if (actions.length) {
      App.clear(footer);
      actions.forEach(function (action) {
        footer.appendChild(App.el('button', {
          class: 'btn ' + (action.variant ? 'btn--' + action.variant : 'btn--ghost'),
          type: 'button', text: action.label, onclick: action.onClick
        }));
      });
      footer.hidden = false;
    } else if (footer) {
      footer.hidden = true;
    }

    /* Re-pointing an already-open panel must close a modal it is sitting on top
       of, but must NOT close the panel itself: doing so would release the
       scroll lock and hand focus back to the previous record's trigger before
       the new one has been recorded. */
    App.closeModal();
    if (!panel.classList.contains('is-open')) panel._returnFocus = document.activeElement;

    panel.classList.add('is-open');
    if (!panel.classList.contains('was-open')) lockScroll();
    panel.classList.add('was-open');
    const scrim = App.qs('#app-panel-scrim');
    if (scrim) scrim.classList.add('is-visible');

    /* Focus the panel itself rather than the close button: the first thing a
       reader wants is the heading, and the title is what announces the record.
       `.drawer__title` is not focusable, so the panel takes focus itself. */
    panel.setAttribute('tabindex', '-1');
    panel.focus();
    return panel;
  };

  App.closePanel = function () {
    const panel = App.qs('#app-panel');
    if (!panel) return;
    if (panel.classList.contains('is-open')) unlockScroll();
    panel.classList.remove('is-open', 'was-open');
    const scrim = App.qs('#app-panel-scrim');
    if (scrim) scrim.classList.remove('is-visible');
    /* Return focus to whatever opened the panel.
     *
     * A closed `.drawer` is `visibility: hidden`, so anything still focused
     * inside it is inert and unreachable — focus cannot simply be left there.
     * The trigger is usually the row or button (both are focusable), but a
     * mouse click on a non-focusable trigger, or a programmatic call, leaves
     * `<body>` as the active element, and `<body>` cannot hold focus either.
     * `#main-content` is the same landing spot the skip link uses, so that is
     * where the reader is put when there is no usable trigger. */
    const trigger = panel._returnFocus;
    const restoreTo = (trigger && trigger !== document.body
      && trigger !== panel && document.body.contains(trigger)) ? trigger
      : App.qs('#main-content');
    if (restoreTo && restoreTo.focus) restoreTo.focus();
    panel._returnFocus = null;
  };

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    /* One layer at a time, topmost first (modal 130 > panel 70 > sidebar).
       Closing all three at once would mean Escape on a delete confirmation
       raised from inside the profile panel also threw away the panel, so the
       reader lost the record they were working on. */
    if (App.isModalOpen()) { App.closeModal(); return; }
    App.closePanel();
    closeSidebar();
  });

  /* =========================================================================
   * 6. APP SHELL (sidebar + topbar + footer)
   * ====================================================================== */

  App.NAV = [
    {
      group: 'Overview',
      items: [{ id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'dashboard' }]
    },
    {
      group: 'Academics',
      items: [
        { id: 'students', label: 'Students', href: 'pages/students.html', icon: 'users', badge: '2000' },
        { id: 'teachers', label: 'Teachers', href: 'pages/teachers.html', icon: 'user-check', badge: '50' },
        { id: 'classes', label: 'Classes & Subjects', href: 'pages/classes.html', icon: 'school', badge: '13' },
        { id: 'attendance', label: 'Attendance', href: 'pages/attendance.html', icon: 'clipboard' },
        { id: 'assignments', label: 'Assignments', href: 'pages/assignments.html', icon: 'book' },
        { id: 'exams', label: 'Exams & Results', href: 'pages/exams.html', icon: 'award' }
      ]
    },
    {
      group: 'Operations',
      items: [
        { id: 'fees', label: 'Fees', href: 'pages/fees.html', icon: 'wallet' },
        { id: 'announcements', label: 'Announcements', href: 'pages/announcements.html', icon: 'megaphone' }
      ]
    },
    {
      group: 'System',
      items: [{ id: 'settings', label: 'Settings', href: 'pages/settings.html', icon: 'settings' }]
    }
  ];

  function navHref(href) { return App.base + href; }

  function buildSidebar() {
    const sidebar = App.el('aside', {
      /* `.drawer--left` supplies the mobile slide-over contract (see css
         `.drawer`); `.sidebar` re-skins it navy and sizes it. */
      class: 'sidebar drawer drawer--left',
      id: 'app-sidebar',
      'aria-label': 'Main navigation'
    });

    /* Brand header. The inner anchor is the home link; the dismiss button sits
       beside it (not inside it) so it stays out of the link's accessible
       name and its own tap target. */
    sidebar.appendChild(App.el('div', { class: 'sidebar__brand' }, [
      App.el('a', {
        class: 'sidebar__brand-link',
        href: navHref('index.html'),
        'aria-label': App.brand + ' — home'
      }, [
        App.el('span', { class: 'sidebar__logo' }, [
          App.el('img', { src: navHref('assets/images/logo.svg'), alt: '', width: '26', height: '26' })
        ]),
        App.el('span', { class: 'sidebar__brand-text' }, [
          App.el('span', { class: 'sidebar__title', text: App.brand }),
          App.el('span', { class: 'sidebar__subtitle', text: Data.school.level + ' • ' + Data.school.session })
        ])
      ]),
      App.el('button', {
        class: 'sidebar__close', type: 'button', 'aria-label': 'Close navigation menu',
        html: App.icon('close')
      })
    ]));

    /* Navigation links */
    const nav = App.el('nav', { class: 'sidebar__nav', 'aria-label': 'Sections' });
    App.NAV.forEach(function (group) {
      const groupNode = App.el('div', { class: 'nav__group' }, [
        App.el('p', { class: 'nav__group-title', text: group.group })
      ]);
      group.items.forEach(function (item) {
        const active = item.id === App.page;
        groupNode.appendChild(App.el('a', {
          class: 'nav__link' + (active ? ' is-active' : ''),
          href: navHref(item.href),
          'aria-current': active ? 'page' : null,
          title: item.label
        }, [
          App.el('span', { class: 'nav__link__icon', html: App.icon(item.icon) }),
          App.el('span', { class: 'nav__link__label', text: item.label }),
          item.badge ? App.el('span', { class: 'nav__badge', text: item.badge }) : null
        ]));
      });
      nav.appendChild(groupNode);
    });
    sidebar.appendChild(nav);

    /* Signed-in user + school footer */
    sidebar.appendChild(App.el('div', { class: 'sidebar__footer' }, [
      App.el('div', { class: 'sidebar__profile' }, [
        App.el('span', { class: 'avatar', text: App.format.initials(Data.school.principal) }),
        App.el('span', { class: 'sidebar__profile-text' }, [
          App.el('span', { class: 'sidebar__profile-name', text: Data.school.principal }),
          App.el('span', { class: 'sidebar__profile-role', text: 'Principal • Administrator' })
        ])
      ]),
      App.el('p', { class: 'mt-1', text: Data.school.addressShort })
    ]));

    return sidebar;
  }

  /* =========================================================================
   * 6b. GLOBAL SEARCH (students + teachers)
   *
   * A combobox over the demo dataset: typing filters 2,000 students and 50
   * teachers and shows the best matches in a dropdown. Only the first
   * SEARCH_MAX_RESULTS entries are ever turned into DOM nodes, so the list
   * size never depends on how many records match.
   * ====================================================================== */
  const SEARCH_MAX_RESULTS = 8;

  /* Below this length there are hundreds of matches ("a" hits nearly every
   * Sindhi name), so the dropdown stays shut until the query is meaningful. */
  const SEARCH_MIN_CHARS = 2;

  /**
   * Scores a record against a lowercase query. Lower is better; -1 means no
   * match at all. Prefix hits on the name beat a hit anywhere else, so typing
   * "ali" surfaces "Ali" before "Khalid".
   */
  function searchScore(needle, record) {
    const name = record.name.toLowerCase();
    if (name.indexOf(needle) === 0) return 0;
    if (name.indexOf(needle) > -1) return 1;
    if (record.secondary.toLowerCase().indexOf(needle) > -1) return 2;
    return -1;
  }

  /**
   * Runs the query over both datasets.
   *
   * Students and teachers are ranked in separate pools and then interleaved,
   * so a query like "Ali" that matches both populations shows teachers as well
   * as students. With one empty pool the round-robin degrades gracefully to
   * simply taking the top N of the other.
   *
   * @returns {{query:string, total:number, results:Array}}
   */
  App.globalSearch = function (query) {
    const needle = String(query || '').trim().toLowerCase();
    if (needle.length < SEARCH_MIN_CHARS) {
      return { query: needle, tooShort: true, total: 0, results: [] };
    }

    /* Shared ranking: score first, then alphabetical. */
    function byRank (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return a.record.name.localeCompare(b.record.name);
    }

    const studentHits = [];
    for (let i = 0; i < Data.students.length; i++) {
      const student = Data.students[i];
      const record = {
        kind: 'student',
        id: student.id,
        name: student.name,
        /* GR number and roll number are searchable so staff can look a child
         * up from a paper register. */
        secondary: [student.grNo, student.rollNo, student.className, student.sectionName].join(' '),
        meta: student.className + ' - ' + student.sectionName + ' • Roll ' + student.rollNo,
        href: navHref('pages/students.html') + '?search=' + encodeURIComponent(student.name)
      };
      const score = searchScore(needle, record);
      if (score > -1) studentHits.push({ score: score, record: record });
    }

    const teacherHits = [];
    for (let i = 0; i < Data.teachers.length; i++) {
      const teacher = Data.teachers[i];
      const record = {
        kind: 'teacher',
        id: teacher.id,
        name: teacher.name,
        secondary: [teacher.mainSubject, teacher.email, teacher.designation, teacher.staffId].join(' '),
        meta: teacher.mainSubject + ' • ' + teacher.designation,
        href: navHref('pages/teachers.html') + '?search=' + encodeURIComponent(teacher.name)
      };
      const score = searchScore(needle, record);
      if (score > -1) teacherHits.push({ score: score, record: record });
    }

    studentHits.sort(byRank);
    teacherHits.sort(byRank);

    const pools = [studentHits, teacherHits];
    const results = [];
    for (let i = 0; results.length < SEARCH_MAX_RESULTS; i++) {
      const row = pools.map(function (pool) { return pool[i]; });
      if (!row[0] && !row[1]) break;
      for (let k = 0; k < pools.length && results.length < SEARCH_MAX_RESULTS; k++) {
        if (row[k]) results.push(row[k].record);
      }
    }

    return {
      query: needle,
      tooShort: false,
      total: studentHits.length + teacherHits.length,
      counts: { student: studentHits.length, teacher: teacherHits.length },
      results: results
    };
  };

  /** Builds the search box. Returns the pieces so mountShell can wire them. */
  function buildSearch() {
    const listId = 'global-search-results';

    const input = App.el('input', {
      id: 'global-search',
      class: 'search__input',
      type: 'search',
      role: 'combobox',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      placeholder: 'Search students or teachers…',
      'aria-label': 'Search students and teachers',
      'aria-autocomplete': 'list',
      'aria-controls': listId,
      'aria-expanded': 'false',
      'aria-describedby': 'global-search-status'
    });

    const list = App.el('ul', {
      id: listId,
      class: 'search__results',
      role: 'listbox',
      'aria-label': 'Search results'
    });

    const empty = App.el('p', { class: 'search__empty' });

    /* One "see them all" link per dataset, so the count on the link is
       always the count that page will actually show. */
    const moreStudent = App.el('a', { class: 'search__more-link' });
    const moreTeacher = App.el('a', { class: 'search__more-link' });

    const footer = App.el('div', { class: 'search__foot' }, [moreStudent, moreTeacher]);

    const panel = App.el('div', { class: 'search__panel', hidden: true }, [list, empty, footer]);

    const status = App.el('p', {
      id: 'global-search-status', class: 'sr-only search__status',
      role: 'status', 'aria-live': 'polite'
    });

    const node = App.el('div', { class: 'search', role: 'search' }, [
      App.el('span', { class: 'search__icon', 'aria-hidden': 'true', html: App.icon('search') }),
      input,
      App.el('button', {
        class: 'search__clear', type: 'button', hidden: true,
        'aria-label': 'Clear search', html: App.icon('close')
      }),
      panel,
      status
    ]);

    return {
      node: node, input: input, panel: panel, list: list, empty: empty,
      footer: footer, moreStudent: moreStudent, moreTeacher: moreTeacher,
      status: status
    };
  }

  /** Wires the combobox: debounce, render, keyboard, outside click. */
  function wireSearch(box) {
    const input = box.input;
    const panel = box.panel;
    const list = box.list;
    let activeIndex = -1;

    function options() { return App.qsa('.search__option', list); }

    function setOpen(open) {
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      if (!open) {
        activeIndex = -1;
        input.removeAttribute('aria-activedescendant');
        options().forEach(function (node) {
          node.classList.remove('is-active');
          node.setAttribute('aria-selected', 'false');
        });
      }
    }

    /** Highlights option `i` and keeps aria-activedescendant in sync. */
    function highlight(i) {
      const all = options();
      if (!all.length) return;
      activeIndex = (i + all.length) % all.length;
      all.forEach(function (node, index) {
        const on = index === activeIndex;
        node.classList.toggle('is-active', on);
        node.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const current = all[activeIndex];
      input.setAttribute('aria-activedescendant', current.id);
      if (current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
    }

    /** Deep link that opens the full register/list for the current query. */
    function moreHref(outcome, kind) {
      const page = kind === 'teacher' ? 'pages/teachers.html' : 'pages/students.html';
      return navHref(page) + '?search=' + encodeURIComponent(outcome.query);
    }

    /** Fills the footer with one "see them all" link per dataset. */
    function renderFooter(outcome) {
      const links = [
        { node: box.moreStudent, kind: 'student', count: outcome.counts.student, noun: 'student' },
        { node: box.moreTeacher, kind: 'teacher', count: outcome.counts.teacher, noun: 'teacher' }
      ];
      let shown = 0;
      links.forEach(function (link) {
        link.node.hidden = !link.count;
        if (!link.count) return;
        shown++;
        link.node.href = moreHref(outcome, link.kind);
        link.node.textContent = link.count === 1
          ? 'All ' + link.count + ' ' + link.noun + ' matches'
          : 'All ' + link.count + ' ' + link.noun + 's match';
      });
      box.footer.hidden = shown === 0;
    }

    function render(outcome) {
      App.clear(list);
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');

      /* Empty box, or too short a query to be worth filtering 2,050 records. */
      if (!outcome.query || outcome.tooShort) {
        setOpen(false);
        box.status.textContent = '';
        return;
      }

      if (!outcome.results.length) {
        box.empty.textContent = 'No student or teacher matches “' + outcome.query + '”.';
        box.empty.hidden = false;
        list.hidden = true;
        box.footer.hidden = true;
        box.status.textContent = 'No matches found for ' + outcome.query;
        setOpen(true);
        return;
      }

      box.empty.hidden = true;
      list.hidden = false;

      outcome.results.forEach(function (record, i) {
        /* The option is a real <a>, so click, middle-click and ctrl-click all
           behave natively; the wrapper <li> is presentational for the listbox. */
        list.appendChild(App.el('li', { role: 'presentation' }, [
          App.el('a', {
            class: 'search__option',
            id: 'global-search-option-' + i,
            role: 'option',
            href: record.href,
            'aria-selected': 'false'
          }, [
            App.el('span', {
              class: 'avatar avatar--sm avatar--' + (record.kind === 'teacher' ? 'staff' : 'neutral'),
              'aria-hidden': 'true',
              text: App.format.initials(record.name)
            }),
            App.el('span', { class: 'search__option-text' }, [
              App.el('span', { class: 'search__option-name', text: record.name }),
              App.el('span', { class: 'search__option-meta', text: record.meta })
            ]),
            App.el('span', {
              class: 'badge badge--' + (record.kind === 'teacher' ? 'info' : 'neutral'),
              text: record.kind === 'teacher' ? 'Teacher' : 'Student'
            })
          ])
        ]));
      });

      renderFooter(outcome);

      box.status.textContent = outcome.total + ' match' + (outcome.total === 1 ? '' : 'es')
        + ' for ' + outcome.query + '. Use the arrow keys to review them.';
      setOpen(true);
    }

    const runSearch = App.debounce(function () {
      render(App.globalSearch(input.value));
      box.node.querySelector('.search__clear').hidden = !input.value;
    }, 200);

    input.addEventListener('input', runSearch);
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2) render(App.globalSearch(input.value));
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (panel.hidden) render(App.globalSearch(input.value));
        highlight(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight(activeIndex - 1);
      } else if (event.key === 'Home' && !panel.hidden) {
        event.preventDefault();
        highlight(0);
      } else if (event.key === 'End' && !panel.hidden) {
        event.preventDefault();
        highlight(options().length - 1);
      } else if (event.key === 'Enter') {
        const active = options()[activeIndex];
        if (active) {
          event.preventDefault();
          window.location.href = active.href;
        }
      } else if (event.key === 'Escape') {
        if (!panel.hidden) { event.preventDefault(); setOpen(false); }
        else { input.value = ''; box.node.querySelector('.search__clear').hidden = true; }
      }
    });

    box.node.querySelector('.search__clear').addEventListener('click', function () {
      input.value = '';
      this.hidden = true;
      setOpen(false);
      box.status.textContent = 'Search cleared';
      input.focus();
    });

    /* Close when focus or a click lands outside the search box. */
    document.addEventListener('click', function (event) {
      if (!box.node.contains(event.target)) setOpen(false);
    });

    return { close: setOpen };
  }

  function buildTopbar() {
    const pageMeta = App.pageMeta();
    const search = buildSearch();

    /* Pinned announcements are the ones an administrator has not actioned. */
    const pinned = Data.announcements.filter(function (item) { return item.pinned; }).length;

    const bell = App.el('button', {
      class: 'topbar__icon-btn', type: 'button',
      title: pinned + ' pinned announcement' + (pinned === 1 ? '' : 's')
        + ' of ' + Data.announcements.length,
      'aria-label': 'Notifications: ' + pinned + ' pinned announcement'
        + (pinned === 1 ? '' : 's') + ', ' + Data.announcements.length + ' in total'
    }, [
      App.iconNode('bell'),
      App.el('span', {
        class: 'topbar__badge', 'aria-hidden': 'true',
        text: pinned > 9 ? '9+' : String(pinned)
      })
    ]);

    return App.el('header', { class: 'topbar' }, [
      App.el('button', {
        class: 'topbar__menu', type: 'button', 'aria-label': 'Open navigation menu',
        'aria-controls': 'app-sidebar', 'aria-expanded': 'false',
        html: App.icon('menu')
      }),
      App.el('div', { class: 'topbar__heading' }, [
        App.el('span', { class: 'topbar__title', text: pageMeta.title }),
        App.el('span', { class: 'topbar__subtitle', text: pageMeta.subtitle })
      ]),
      search.node,
      App.el('div', { class: 'topbar__actions' }, [
        bell,
        App.el('span', { class: 'topbar__user' }, [
          App.el('span', { class: 'avatar', 'aria-hidden': 'true', text: App.user.initials }),
          App.el('span', { class: 'topbar__user-text' }, [
            App.el('span', { class: 'topbar__user-name', text: App.user.name }),
            App.el('span', { class: 'topbar__user-role', text: App.user.role })
          ])
        ])
      ])
    ]);
  }

  function buildFooter() {
    return App.el('footer', { class: 'footer' }, [
      App.el('div', { class: 'footer__inner' }, [
        App.el('p', { class: 'footer__brand', text: App.brand }),
        App.el('p', {
          text: 'Session ' + Data.school.session + ' (April to March) • ' + Data.school.addressShort
            + ' • ' + Data.school.phone
        }),
        App.el('p', {
          class: 'text-muted',
          text: 'Prototype with fictional demo data only — no real student records are stored or displayed.'
        }),
        App.el('nav', { class: 'footer__links', 'aria-label': 'Footer' }, [
          App.el('a', { href: navHref('index.html'), text: 'Dashboard' }),
          App.el('a', { href: navHref('pages/students.html'), text: 'Students' }),
          App.el('a', { href: navHref('pages/settings.html'), text: 'Settings' }),
          App.el('span', { class: 'text-muted', text: '© ' + new Date().getFullYear() + ' ' + App.brand })
        ])
      ])
    ]);
  }

  /** Title + subtitle for the topbar, derived from the nav config. */
  App.pageMeta = function () {
    const found = App.NAV.reduce(function (carry, group) {
      const match = group.items.filter(function (item) { return item.id === App.page; })[0];
      return match || carry;
    }, null);
    return {
      title: found ? found.label : App.brand,
      subtitle: Data.school.level + ' • Session ' + Data.school.session + ' • ' + Data.school.addressShort
    };
  };

  /** Keeps the browser tab title consistent with the brand. */
  App.setTitle = function (title) {
    document.title = title ? title + ' | ' + App.brand : App.brand;
  };

  /* ---- Sidebar drawer (mobile) ---------------------------------------- */
  let lastFocused = null;

  /* Only one overlay at a time: the panel and the modal both sit above the
     register they describe, and stacking them would leave focus in a dialog
     nobody can see. Used by the global search, which opens a result page. */
  App.closeOverlays = function () {
    App.closeModal();
    App.closePanel();
  };

  function openSidebar() {
    const sidebar = App.qs('#app-sidebar');
    const backdrop = App.qs('#sidebar-backdrop');
    const menu = App.qs('.topbar__menu');
    if (!sidebar) return;
    /* The drawer only exists below the tablet breakpoint; from tablet up the
     * sidebar is a permanent rail. The hamburger is hidden there, but this
     * keeps a programmatic call from stranding `body { overflow: hidden }`. */
    if (App.layout !== 'mobile') return;
    lastFocused = document.activeElement;
    sidebar.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-visible');
    if (menu) menu.setAttribute('aria-expanded', 'true');
    if (!sidebar.classList.contains('was-open')) lockScroll();
    sidebar.classList.add('was-open');
    const firstLink = sidebar.querySelector('.nav__link');
    if (firstLink) firstLink.focus();
  }

  function closeSidebar() {
    const sidebar = App.qs('#app-sidebar');
    const backdrop = App.qs('#sidebar-backdrop');
    const menu = App.qs('.topbar__menu');
    if (!sidebar || !sidebar.classList.contains('is-open')) return;
    if (sidebar.classList.contains('was-open')) unlockScroll();
    sidebar.classList.remove('is-open', 'was-open');
    if (backdrop) backdrop.classList.remove('is-visible');
    if (menu) menu.setAttribute('aria-expanded', 'false');

    /* Return focus to whatever opened the drawer. That is often <body> (a mouse
     * click never moves focus first), and <body> cannot hold focus — so without
     * this fallback focus would be stranded on a nav link inside the panel that
     * has just become hidden. */
    const restoreTo = (lastFocused && lastFocused !== document.body
      && document.body.contains(lastFocused)) ? lastFocused : menu;
    if (restoreTo && restoreTo.focus) restoreTo.focus();
    lastFocused = null;
  }

  function toggleSidebar() {
    const sidebar = App.qs('#app-sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('is-open')) closeSidebar();
    else openSidebar();
  }
  App.closeSidebar = closeSidebar;

  /* =========================================================================
   * BREAKPOINTS
   *
   * Mirrors the media queries in css/responsive.css. The CSS remains the source
   * of truth for layout — this only exists so the drawer can behave itself when
   * the viewport changes underneath it.
   * ====================================================================== */
  App.LAYOUT = { tablet: 768, desktop: 1024 };

  /** Classifies a viewport width as 'mobile' | 'tablet' | 'desktop'. */
  function layoutForWidth(width) {
    if (width >= App.LAYOUT.desktop) return 'desktop';
    if (width >= App.LAYOUT.tablet) return 'tablet';
    return 'mobile';
  }

  /* Keep the two queries around so detection and change notification read the
   * same object rather than re-parsing the strings. */
  const widthQueries = typeof global.matchMedia === 'function'
    ? {
        tablet: global.matchMedia('(min-width: ' + App.LAYOUT.tablet + 'px)'),
        desktop: global.matchMedia('(min-width: ' + App.LAYOUT.desktop + 'px)')
      }
    : null;

  function detectLayout() {
    /* matchMedia is the only way to be certain of agreeing with CSS: a
     * `min-width` media feature matches on the viewport width *including* a
     * classic scrollbar, which is `window.innerWidth`, not
     * `documentElement.clientWidth`. Using clientWidth would classify a
     * 1024px-wide window with a 15px scrollbar as a tablet while the stylesheet
     * was already showing the desktop sidebar. */
    if (widthQueries) {
      if (widthQueries.desktop.matches) return 'desktop';
      if (widthQueries.tablet.matches) return 'tablet';
      return 'mobile';
    }
    return layoutForWidth(global.innerWidth || document.documentElement.clientWidth || 0);
  }

  App.layout = detectLayout();
  const layoutListeners = [];

  /**
   * Publishes the current layout on <html data-layout> and notifies listeners.
   * The attribute is informational (CSS keys off media queries) but makes the
   * layout inspectable and testable.
   */
  function publishLayout() {
    const next = detectLayout();
    if (next === App.layout) return;
    const previous = App.layout;
    App.layout = next;
    document.documentElement.setAttribute('data-layout', next);

    /* Leaving the mobile range while the drawer is open would otherwise leave
     * `.is-open` on a panel that is now a permanent rail, the scrim showing,
     * and `body { overflow: hidden }` in force — an unscrollable page with a
     * stranded focus trap. */
    if (previous === 'mobile' && next !== 'mobile') closeSidebar();

    layoutListeners.forEach(function (fn) { fn(next, previous); });
  }
  App.onLayoutChange = function (fn) { layoutListeners.push(fn); };

  /* matchMedia change events are the cheap way to hear about breakpoint
   * crossings, but it is absent in jsdom and in a few very old engines, so fall
   * back to a debounced resize listener. Either way the layout still resolves
   * without JS — CSS drives the visuals. */
  (function watchLayout() {
    document.documentElement.setAttribute('data-layout', App.layout);

    if (widthQueries) {
      const handler = function () { publishLayout(); };
      [widthQueries.tablet, widthQueries.desktop].forEach(function (query) {
        if (query.addEventListener) query.addEventListener('change', handler);
        else if (query.addListener) query.addListener(handler);
      });
      return;
    }

    global.addEventListener('resize', App.debounce(publishLayout, 150));
  }());

  /**
   * Forces a layout re-read. Only needed by test harnesses that change the
   * reported viewport; real browsers emit a resize or a matchMedia change.
   */
  App.refreshLayout = publishLayout;

  /* ---- Focus trap while an overlay is open ------------------------------ */
  /* One handler for every layer: Tab has to stay inside whichever overlay is
     on top. The order is the stacking order (modal, then panel, then the
     mobile sidebar), because a modal can be raised from inside the profile
     panel — in that state the panel must not be allowed to steal the Tab. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab') return;
    /* `App.qs(selector, root)` is deliberately not used with `.map()` here:
       `map` hands the element's *index* as the second argument, so that call
       would ask `document.querySelector` of a number to resolve the selector. */
    const layers = ['#app-modal', '#app-panel', '#app-sidebar'];
    let container = null;
    for (let i = 0; i < layers.length; i++) {
      const node = App.qs(layers[i]);
      if (node && node.classList.contains('is-open')) { container = node; break; }
    }
    if (!container) return;
    /* `disabled`, `hidden` and `tabindex="-1"` are all excluded: a form's
       submit is disabled while the form is invalid, a drawer footer may be
       present-but-empty, and the visually-hidden submit button that makes Enter
       work is focusable only from script — none of the three may be offered to
       Tab as a stop. */
    const focusable = App.qsa(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]),'
      + ' input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]),'
      + ' textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (node) { return !node.hasAttribute('hidden'); });
    if (!focusable.length) {
      /* Nothing to move to (a dialog whose only control is disabled): keep
         focus on the dialog itself rather than letting it fall out to the
         page behind. */
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  /** Mounts sidebar / topbar / footer into the page skeleton. */
  App.mountShell = function () {
    const shell = App.qs('.shell');
    const main = App.qs('.app__main');
    if (!shell || !main) return;

    shell.insertBefore(buildSidebar(), main);

    const topbarMount = App.qs('#topbar-mount');
    if (topbarMount) topbarMount.replaceWith(buildTopbar());
    else main.insertBefore(buildTopbar(), main.firstChild);

    const footerMount = App.qs('#footer-mount');
    if (footerMount) footerMount.replaceWith(buildFooter());

    /* Backdrop + drawer wiring */
    if (!App.qs('#sidebar-backdrop')) {
      document.body.appendChild(App.el('div', { class: 'backdrop', id: 'sidebar-backdrop' }));
    }
    App.qs('#sidebar-backdrop').addEventListener('click', closeSidebar);
    const menuButton = App.qs('.topbar__menu');
    if (menuButton) menuButton.addEventListener('click', toggleSidebar);
    const closeButton = App.qs('.sidebar__close');
    if (closeButton) closeButton.addEventListener('click', closeSidebar);

    /* Close the drawer when a nav link or the brand is followed.
     *
     * Most of the time the browser navigates away and the point is moot — but
     * clicking the link for the page you are already on does not navigate, so
     * without this the drawer would stay open over the page the user just
     * asked for. closeSidebar() is a no-op on tablet and desktop, where the
     * sidebar is a permanent rail and never carries `.is-open`. */
    const sidebarEl = App.qs('#app-sidebar');
    if (sidebarEl) {
      sidebarEl.addEventListener('click', function (event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        closeSidebar();
      });
    }

    /* Global search combobox (topbar) */
    const searchBox = App.qs('.search');
    if (searchBox) wireSearch({
      node: searchBox,
      input: App.qs('.search__input', searchBox),
      panel: App.qs('.search__panel', searchBox),
      list: App.qs('.search__results', searchBox),
      empty: App.qs('.search__empty', searchBox),
      footer: App.qs('.search__foot', searchBox),
      moreStudent: App.qsa('.search__more-link', searchBox)[0],
      moreTeacher: App.qsa('.search__more-link', searchBox)[1],
      status: App.qs('.search__status', searchBox)
    });

    /* Topbar actions */
    const bell = App.qs('.topbar__icon-btn');
    if (bell) {
      bell.addEventListener('click', function () {
        window.location.href = navHref('pages/announcements.html');
      });
    }
  };

  /* =========================================================================
   * 7. REUSABLE DATA TABLE
   *    Search (debounced) + filters + sortable columns + pagination.
   *    Only the rows of the current page are ever written to the DOM, so a
   *    2,000-record list stays fast.
   * ====================================================================== */

  /**
   * @param {Object} options
   * @param {Element|string} options.mount       container
   * @param {Array}  options.rows                data array
   * @param {Array}  options.columns             [{ key, label, sortable, align, width, render(row), sortValue(row) }]
   * @param {Array}  [options.filters]           [{ key, label, options | optionsFn, allLabel }]
   * @param {Array}  [options.searchKeys]        keys matched by the search box
   * @param {number} [options.pageSize]          default 25
   * @param {function} [options.onRowClick]
   * @param {Object} [options.initialSort]       { key, dir }
   * @param {string} [options.exportName]        enables a CSV button when set
   */
  App.createDataTable = function (options) {
    const mount = typeof options.mount === 'string' ? App.qs(options.mount) : options.mount;
    if (!mount) { console.warn('App.createDataTable: mount element not found'); return null; }

    const columns = options.columns || [];
    const pageSizes = options.pageSizes || [10, 25, 50, 100];
    const state = {
      rows: options.rows || [],
      view: [],
      page: 1,
      pageSize: options.pageSize || 25,
      query: '',
      sortKey: (options.initialSort && options.initialSort.key) || null,
      sortDir: (options.initialSort && options.initialSort.dir) || 'asc',
      filterValues: {}
    };

    /* ---------- toolbar ---------- */
    const inputId = options.id ? options.id + '-search' : 'table-search';
    const searchInput = App.el('input', {
      class: 'input', type: 'search', id: inputId,
      placeholder: options.searchPlaceholder || 'Search…',
      'aria-label': options.searchLabel || 'Search records'
    });

    const filterSelects = [];
    const toolbar = App.el('div', { class: 'table-toolbar' });
    if (options.search !== false) {
      toolbar.appendChild(App.el('div', { class: 'table-toolbar__search' }, [
        App.el('div', { class: 'input-group' }, [
          App.el('span', { class: 'icon', html: App.icon('search', 'icon--sm'), 'aria-hidden': 'true' }),
          searchInput
        ])
      ]));
    }

    (options.filters || []).forEach(function (filter, index) {
      const select = App.el('select', {
        class: 'select', id: 'filter-' + filter.key + '-' + index,
        'aria-label': filter.label
      });
      filterSelects.push({ def: filter, select: select });
      toolbar.appendChild(App.el('div', { class: 'field', style: 'min-width:150px;flex:0 1 180px' }, [
        App.el('label', { class: 'field__label', for: select.id, text: filter.label }),
        select
      ]));
    });

    const pageSizeSelect = App.el('select', {
      class: 'select', id: 'table-page-size',
      style: 'min-width:104px;flex:0 0 auto',
      'aria-label': 'Rows per page'
    }, pageSizes.map(function (size) {
      return App.el('option', { value: size, text: size + ' / page', selected: size === state.pageSize });
    }));

    const exportButton = options.exportName ? App.el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', html: App.icon('download', 'icon--sm') + '<span>CSV</span>'
    }) : null;

    toolbar.appendChild(App.el('div', { class: 'flex gap-1', style: 'align-items:flex-end;margin-left:auto' }, [
      exportButton,
      App.el('div', { class: 'field', style: 'min-width:104px' }, [
        App.el('label', { class: 'field__label', for: 'table-page-size', text: 'Show' }),
        pageSizeSelect
      ])
    ]));

    /* ---------- table ---------- */
    const thead = App.el('thead');
    const headerRow = App.el('tr');
    columns.forEach(function (column) {
      const th = App.el('th', {
        scope: 'col',
        class: column.align === 'right' ? 'num' : null,
        style: column.width ? 'width:' + column.width : null,
        'aria-sort': state.sortKey === column.key
          ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : null
      });
      if (column.sortable === false) {
        th.textContent = column.label;
      } else {
        th.appendChild(App.el('button', {
          class: 'th-sort', type: 'button',
          'aria-label': 'Sort by ' + column.label,
          dataset: { sortKey: column.key }
        }, [
          App.el('span', { text: column.label }),
          App.el('span', {
            class: 'th-sort__icon',
            html: App.icon(state.sortDir === 'asc' ? 'arrow-up' : 'arrow-down', 'icon--sm')
          })
        ]));
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = App.el('tbody');
    const table = App.el('table', { class: 'table' + (options.compact ? ' table--compact' : '') }, [
      App.el('caption', { class: 'sr-only', text: options.caption || 'Records table' }),
      thead,
      tbody
    ]);

    /* Floor width for this table. Dense registers keep their columns legible on
     * a phone and scroll inside `.table-scroll`; pass `minTableWidth: 0` for a
     * narrow two- or three-column table that should simply fill its card. */
    const minTableWidth = options.minTableWidth === undefined ? 720 : options.minTableWidth;
    if (minTableWidth) table.style.setProperty('--table-min-width', minTableWidth + 'px');

    /* Horizontal scroll container.
     *
     * `tabindex="0"` puts the region in the tab order so it can be scrolled
     * from the keyboard — WCAG asks for that wherever content overflows — and
     * `role="region"` + a label gives screen-reader users a handle they can jump
     * to. `.table-scroll` is styled `overflow-x: auto`, so on a phone the table
     * scrolls inside the card while the page itself stays put. */
    const scroll = App.el('div', {
      class: 'table-scroll',
      tabindex: '0',
      role: 'region',
      'aria-label': (options.caption || 'Records') + ' — scrollable table'
    }, [table]);

    /* ---------- footer ---------- */
    const info = App.el('span', { class: 'table-footer__info', role: 'status', 'aria-live': 'polite' });
    const pagination = App.el('nav', { class: 'pagination', 'aria-label': 'Table pages' });
    const footer = App.el('div', { class: 'table-footer' }, [
      App.el('div', { class: 'table-footer__controls' }, [info]),
      pagination
    ]);

    const card = App.el('div', { class: 'card' }, [
      toolbar,
      scroll,
      footer
    ]);
    App.clear(mount);
    mount.appendChild(card);

    /* ---------- behaviour ---------- */

    function populateFilters() {
      filterSelects.forEach(function (item) {
        const list = typeof item.def.options === 'function'
          ? item.def.options(state)
          : (item.def.options || []);
        const previous = state.filterValues[item.def.key] || '';
        App.clear(item.select);
        item.select.appendChild(App.el('option', {
          value: '', text: item.def.allLabel || 'All'
        }));
        list.forEach(function (option) {
          item.select.appendChild(App.el('option', {
            value: option.value,
            text: option.label + (option.count ? ' (' + option.count + ')' : ''),
            selected: String(option.value) === String(previous)
          }));
        });
        item.select.value = previous;
      });
    }

    function applyFilters() {
      let view = state.rows.slice();

      Object.keys(state.filterValues).forEach(function (key) {
        const value = state.filterValues[key];
        if (!value) return;
        view = view.filter(function (row) { return String(row[key]) === String(value); });
      });

      const query = state.query.trim().toLowerCase();
      if (query) {
        const keys = options.searchKeys || columns.map(function (column) { return column.key; });
        view = view.filter(function (row) {
          for (let i = 0; i < keys.length; i++) {
            const cell = row[keys[i]];
            if (cell === undefined || cell === null) continue;
            if (String(cell).toLowerCase().indexOf(query) !== -1) return true;
          }
          return false;
        });
      }

      if (state.sortKey) {
        const column = columns.filter(function (item) { return item.key === state.sortKey; })[0];
        const valueOf = column && column.sortValue
          ? function (row) { return column.sortValue(row); }
          : function (row) { return row[state.sortKey]; };
        const direction = state.sortDir === 'asc' ? 1 : -1;
        view.sort(function (a, b) {
          const av = valueOf(a);
          const bv = valueOf(b);
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
          return String(av === undefined ? '' : av).localeCompare(String(bv === undefined ? '' : bv), 'en', { numeric: true }) * direction;
        });
      }

      state.view = view;
      const maxPage = Math.max(1, Math.ceil(view.length / state.pageSize));
      if (state.page > maxPage) state.page = maxPage;
      renderRows();
    }

    function renderRows() {
      const start = (state.page - 1) * state.pageSize;
      const slice = state.view.slice(start, start + state.pageSize);
      const fragment = document.createDocumentFragment();

      slice.forEach(function (row) {
        const tr = App.el('tr', {
          class: options.onRowClick ? 'row-link' : null,
          tabindex: options.onRowClick ? '0' : null,
          role: options.onRowClick ? 'button' : null,
          dataset: options.rowKey ? { rowKey: row[options.rowKey] } : null
        });
        columns.forEach(function (column) {
          const content = column.render ? column.render(row) : row[column.key];
          const td = App.el('td', {
            class: [column.align === 'right' ? 'num' : null, column.cellClass || null]
              .filter(Boolean).join(' ') || null
          });
          if (content === null || content === undefined) td.textContent = '—';
          else if (typeof content === 'object' && content.nodeType) td.appendChild(content);
          else td.innerHTML = String(content);
          tr.appendChild(td);
        });
        fragment.appendChild(tr);
      });

      App.clear(tbody);
      if (!slice.length) {
        const colspan = columns.length;
        const tr = App.el('tr', {}, [
          App.el('td', { colspan: colspan }, [App.emptyState({
            icon: 'search',
            title: options.emptyTitle || 'No matching records',
            message: options.emptyMessage || 'Adjust the search term or filters to see more results.'
          })])
        ]);
        tbody.appendChild(tr);
      } else {
        tbody.appendChild(fragment);
      }

      /* Info line */
      const from = state.view.length ? start + 1 : 0;
      const to = Math.min(start + state.pageSize, state.view.length);
      info.textContent = 'Showing ' + from + '–' + to + ' of ' + fmt.number(state.view.length)
        + (state.view.length !== state.rows.length ? ' (filtered from ' + fmt.number(state.rows.length) + ')' : '')
        + ' record' + (state.view.length === 1 ? '' : 's');

      renderPagination();
    }

    function renderPagination() {
      /* The pager is rebuilt wholesale, because the number of pages follows
       * the filtered result set and the ellipsis window follows the current
       * page. Rebuilding means the button the reader just activated is thrown
       * away, so its identity is captured first and focus handed to its
       * replacement below — otherwise a keyboard user is dropped on <body>
       * and has to tab from the top of the page again. */
      const active = document.activeElement;
      const pagerHadFocus = !!active && pagination.contains(active);
      const activeLabel = pagerHadFocus ? active.getAttribute('aria-label') : null;

      App.clear(pagination);
      const pageCount = Math.max(1, Math.ceil(state.view.length / state.pageSize));
      if (pageCount <= 1) return;

      function button(label, targetPage, options) {
        const opts = options || {};
        const node = App.el('button', {
          class: 'pagination__btn',
          type: 'button',
          html: opts.icon ? App.icon(opts.icon, 'icon--sm') : String(label),
          'aria-label': opts.ariaLabel || null,
          'aria-current': opts.current ? 'page' : null,
          disabled: opts.disabled || false
        });
        node.addEventListener('click', function () {
          state.page = targetPage;
          renderRows();
          card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        return node;
      }

      pagination.appendChild(button('', state.page - 1, {
        icon: 'chevron-left', disabled: state.page === 1, ariaLabel: 'Previous page'
      }));

      /* Page numbers with ellipsis around the current page. */
      const pages = [];
      for (let page = 1; page <= pageCount; page++) {
        if (page === 1 || page === pageCount || Math.abs(page - state.page) <= 1) pages.push(page);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
      }
      pages.forEach(function (page) {
        if (page === '…') { pagination.appendChild(App.el('span', { class: 'pagination__ellipsis', text: '…' })); return; }
        pagination.appendChild(button(page, page, { current: page === state.page, ariaLabel: 'Page ' + page }));
      });

      pagination.appendChild(button('', state.page + 1, {
        icon: 'chevron-right', disabled: state.page === pageCount, ariaLabel: 'Next page'
      }));

      /* Hand focus to the control that took the reader's place. Matched by
       * aria-label, which is generated here and so needs no escaping; a
       * disabled or vanished match (Previous on page 1) falls back to the
       * current-page button, which is always present. */
      if (pagerHadFocus) {
        let target = null;
        App.qsa('button', pagination).forEach(function (candidate) {
          if (!target && !candidate.disabled
            && candidate.getAttribute('aria-label') === activeLabel) {
            target = candidate;
          }
        });
        if (!target) target = pagination.querySelector('[aria-current="page"]');
        if (target) target.focus();
      }
    }

    function exportCsv() {
      const header = columns.map(function (column) { return column.label; });
      const lines = [header.join(',')];
      state.view.forEach(function (row) {
        const cells = columns.map(function (column) {
          const value = column.exportValue ? column.exportValue(row) : row[column.key];
          return '"' + String(value === undefined || value === null ? '' : value).replace(/"/g, '""') + '"';
        });
        lines.push(cells.join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = App.el('a', { href: URL.createObjectURL(blob), download: options.exportName + '.csv' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      App.toast('Exported ' + state.view.length + ' records to CSV', 'success');
    }

    /* --- events --- */
    if (options.search !== false) {
      searchInput.addEventListener('input', App.debounce(function (event) {
        state.query = event.target.value;
        state.page = 1;
        applyFilters();
      }, 250));
    }

    filterSelects.forEach(function (item) {
      item.select.addEventListener('change', function (event) {
        state.filterValues[item.def.key] = event.target.value;
        state.page = 1;
        populateFilters();
        applyFilters();
      });
    });

    pageSizeSelect.addEventListener('change', function (event) {
      state.pageSize = Number(event.target.value);
      state.page = 1;
      applyFilters();
    });

    headerRow.addEventListener('click', function (event) {
      const button = event.target.closest('.th-sort');
      if (!button) return;
      const key = button.dataset.sortKey;
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = 'asc'; }
      Array.prototype.forEach.call(headerRow.children, function (th) {
        const sortButton = th.querySelector('.th-sort');
        if (!sortButton) return;
        th.setAttribute('aria-sort', sortButton.dataset.sortKey === state.sortKey
          ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        const icon = th.querySelector('.th-sort__icon');
        if (icon) {
          icon.innerHTML = App.icon(sortButton.dataset.sortKey === state.sortKey && state.sortDir === 'desc'
            ? 'arrow-down' : 'arrow-up', 'icon--sm');
        }
      });
      applyFilters();
    });

    const rowKey = options.rowKey || (options.onRowClick ? 'id' : null);
    if (options.onRowClick) {
      tbody.addEventListener('click', function (event) {
        const tr = event.target.closest('tr[data-row-key]');
        if (!tr) return;
        const row = state.view.filter(function (item) {
          return String(item[rowKey]) === tr.dataset.rowKey;
        })[0];
        if (row) options.onRowClick(row);
      });
      tbody.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const tr = event.target.closest('tr[data-row-key]');
        if (!tr) return;
        event.preventDefault();
        tr.click();
      });
    }

    if (exportButton) exportButton.addEventListener('click', exportCsv);

    /* --- first paint --- */
    populateFilters();
    applyFilters();

    return {
      element: card,
      state: state,
      refresh: function (rows) {
        if (rows) state.rows = rows;
        populateFilters();
        applyFilters();
      },
      setFilter: function (key, value) {
        state.filterValues[key] = value;
        state.page = 1;
        populateFilters();
        applyFilters();
      },
      /* Lets the topbar global search deep-link into a register:
         pages/students.html?search=Ali  →  "Ali" in the table search box. */
      setSearch: function (query) {
        state.query = String(query || '');
        searchInput.value = state.query;
        state.page = 1;
        applyFilters();
      },
      destroy: function () { App.clear(mount); }
    };
  };

  /* =========================================================================
   * 8. SMALL SHARED BUILDING BLOCKS
   * ====================================================================== */

  /**
   * Does the visitor ask for reduced motion?
   *
   * The CSS already neutralises transitions under `prefers-reduced-motion`, but
   * a scripted count-up has no CSS to neutralise, so JS has to ask too.
   * `matchMedia` is asked every call rather than cached: a visitor can flip the
   * setting with the OS while the page is open, and the answer is cheap.
   */
  App.prefersReducedMotion = function () {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (error) {
      return false;
    }
  };

  /**
   * Counts a number up from zero with requestAnimationFrame.
   *
   * The caller is expected to have already put the *final* text in the node, so
   * that anything which never runs this (a print, a text-only reader, a browser
   * without rAF, reduced motion) still shows the true figure. Every path that
   * does not animate writes the true figure itself, so the value in the DOM is
   * correct however the function is called. Only the text of an already-correct
   * element is rewritten, and because the node is not a live region this is
   * never announced mid-flight.
   *
   * @param {Element} node      element whose textContent is animated
   * @param {Object} options
   * @param {number} options.to        final value
   * @param {number} [options.from]    starting value (default 0)
   * @param {Function} options.format  (value) => string
   * @param {number} [options.duration] milliseconds (default 900; 0 = do not animate)
   * @param {number} [options.startIn]  delay before the first frame (default 0)
   * @returns {Function} cancel — safe to call at any time
   */
  App.countUp = function (node, options) {
    const opts = options || {};
    const to = Number(opts.to) || 0;
    const from = opts.from === undefined ? 0 : Number(opts.from) || 0;
    const format = opts.format || function (value) { return String(value); };
    /* `duration: 0` has to survive as zero — `Number(0) || 900` would silently
       turn "do not animate this" into "animate it for 900ms". */
    const duration = opts.duration === undefined
      ? 900
      : Math.max(0, Number(opts.duration) || 0);
    const startIn = Math.max(0, Number(opts.startIn) || 0);

    /* No node, or nothing to animate. Every path out of here leaves the true
       figure behind, exactly like `cancel()` does, so the three exits agree. */
    if (!node || duration === 0) {
      if (node) node.textContent = format(to);
      return function () {};
    }
    /* No rAF, or the visitor asks for reduced motion: jump to the value. */
    if (typeof global.requestAnimationFrame !== 'function' || App.prefersReducedMotion()) {
      node.textContent = format(to);
      return function () {};
    }

    let frame = null;
    let cancelled = false;
    let started = null;

    const step = function (now) {
      if (cancelled) return;
      /* Detached nodes stop costing anything. */
      if (!node.isConnected) { cancelled = true; return; }
      if (started === null) started = now;
      const elapsed = now - started - startIn;
      /* Still waiting out the stagger. */
      if (elapsed < 0) { frame = global.requestAnimationFrame(step); return; }
      /* easeOutCubic — fast first, then settles, instead of a linear crawl. */
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = format(from + (to - from) * eased);
      if (t < 1) frame = global.requestAnimationFrame(step);
      else node.textContent = format(to);
    };

    frame = global.requestAnimationFrame(step);
    return function () {
      cancelled = true;
      if (frame !== null && typeof global.cancelAnimationFrame === 'function') {
        global.cancelAnimationFrame(frame);
      }
      /* Always leave the true figure behind. */
      node.textContent = format(to);
    };
  };

  /* Pending count-ups, drained by App.runCountUps(). */
  App.countUpQueue = [];

  /** Runs the count-ups queued by App.statCard(). Call once after rendering. */
  App.runCountUps = function (duration) {
    const queue = App.countUpQueue.splice(0, App.countUpQueue.length);
    queue.forEach(function (item, index) {
      /* A small stagger, so six cards resolve left to right instead of all at
         once. Capped well under the animation itself. */
      const startIn = index * Math.min(90, (duration || 900) / 8);
      App.countUp(item.node, {
        /* The target is read back off the attribute rather than kept in the
           queue item, so the DOM is the single record of what each card wants. */
        to: Number(item.node.getAttribute('data-count-up')),
        format: item.format,
        duration: item.duration === undefined ? duration : item.duration,
        startIn: startIn
      });
    });
  };

  /**
   * KPI stat card.
   *
   * `opts.count` turns the value into an animated count-up: `{ to, format }`.
   * The final formatted string is rendered straight away and only then animated,
   * so the card is never briefly wrong.
   */
  App.statCard = function (options) {
    const opts = options || {};
    const count = opts.count;
    /* A count without a usable target is not a count. Falling back to `value`
       keeps a bad call looking like a plain stat card rather than printing
       "undefined" into the KPI row. */
    const countable = !!count && isFinite(Number(count.to));
    const valueText = countable
      ? (count.format || String)(count.to)
      : (opts.value === undefined ? '—' : opts.value);

    const value = App.el('span', {
      class: 'stat-card__value',
      text: valueText
    });

    if (countable) {
      /* `data-count-up` is the declarative record of the target — handy for
         styling and for tests — while the queue below carries the formatter,
         which cannot be expressed as an attribute. */
      value.setAttribute('data-count-up', String(count.to));
      App.countUpQueue.push({ node: value, format: count.format, duration: count.duration });
    }

    return App.el('div', { class: 'stat-card' }, [
      opts.icon ? App.el('div', {
        class: 'stat-card__icon' + (opts.tone ? ' stat-card__icon--' + opts.tone : ''),
        html: App.icon(opts.icon)
      }) : null,
      App.el('span', { class: 'stat-card__label', text: opts.label }),
      value,
      opts.hint ? App.el('span', { class: 'stat-card__hint', text: opts.hint }) : null
    ]);
  };

  /* =========================================================================
   * CHARTS — pure CSS / inline SVG, no chart library
   * ====================================================================== */

  /**
   * Multi-segment donut, built from a conic-gradient.
   *
   * Segments are drawn with a `conic-gradient` rather than SVG arcs because a
   * gradient keeps the hole, the sizing and the centring in CSS, where the
   * single-value `.donut` already lives.
   *
   * `color` must be a CSS colour the stylesheet already owns — in this project
   * that means a design token, e.g. 'var(--color-accent)'. Passing a literal
   * here would put a colour outside the token layer.
   *
   * @param {Array<{label:string,value:number,color:string,note?:string}>} segments
   * @param {Object} [options]
   * @param {string} [options.centerValue] big number in the hole
   * @param {string} [options.centerLabel] caption in the hole
   * @param {string} [options.label]       accessible name for the ring
   * @param {boolean} [options.legend]     render the legend (default true)
   * @param {Function} [options.format]    (value) => string for legend figures
   *                                        (default: a grouped integer)
   */
  App.donutSegments = function (segments, options) {
    const opts = options || {};
    const rows = (segments || []).filter(function (segment) {
      return Number(segment.value) > 0;
    });
    const total = rows.reduce(function (sum, segment) { return sum + Number(segment.value); }, 0);

    /* Cumulative stops: "colour 0 40%, next-colour 40% 75%, …". */
    let cursor = 0;
    const stops = rows.map(function (segment) {
      const share = total ? (Number(segment.value) / total) * 100 : 0;
      const stop = segment.color + ' ' + cursor.toFixed(2) + '% ' + (cursor + share).toFixed(2) + '%';
      cursor += share;
      return stop;
    });

    const ring = App.el('div', {
      class: 'donut donut--segments',
      role: 'img',
      'aria-label': (opts.label || 'Distribution') + ': '
        + rows.map(function (segment) {
          return segment.label + ' ' + (total ? Math.round((Number(segment.value) / total) * 1000) / 10 : 0) + '%';
        }).join(', ')
    }, [
      App.el('div', { class: 'donut__hole' }, [
        App.el('span', {}, [
          App.el('span', { class: 'donut__value', text: opts.centerValue === undefined ? fmt.number(total) : opts.centerValue }),
          App.el('span', { class: 'donut__label', text: opts.centerLabel || 'total' })
        ])
      ])
    ]);
    ring.style.background = stops.length
      ? 'conic-gradient(' + stops.join(', ') + ')'
      : '';

    /* Callers with money or percentages pass their own formatter; counts are
       the default. */
    const format = opts.format || fmt.number;
    const legend = App.el('ul', { class: 'legend' });
    rows.forEach(function (segment) {
      const percent = total ? Math.round((Number(segment.value) / total) * 1000) / 10 : 0;
      legend.appendChild(App.el('li', { class: 'legend__row' }, [
        App.el('span', { class: 'legend__swatch' }),
        App.el('span', { class: 'legend__label', text: segment.label }),
        App.el('span', { class: 'legend__value', text: format(segment.value) }),
        App.el('span', { class: 'legend__percent', text: percent + '%' })
      ]));
      /* The swatch colour comes from the same token the gradient used. */
      legend.lastChild.firstChild.style.background = segment.color;
    });

    const wrap = App.el('div', { class: 'donut-split' }, [ring]);
    if (opts.legend !== false) wrap.appendChild(legend);
    return wrap;
  };

  /**
   * Sparkline-style line chart in inline SVG (no library).
   *
   * The SVG carries only the shape — area, line and the two gridlines — with a
   * 0-100 viewBox and `preserveAspectRatio="none"`, so it stretches to any
   * width without a resize listener. `vector-effect="non-scaling-stroke"` keeps
   * the stroke 2px whatever the box ends up being.
   *
   * Everything textual (day labels, values, markers) is HTML layered on top,
   * because SVG text inside a non-uniformly scaled viewBox would be stretched
   * out of shape. The whole thing is exposed to assistive tech as one `role="img"`
   * with a full text summary, plus a `<details>` table the caller can add.
   *
   * @param {Array<{label:string,value:number,note?:string}>} points
   * @param {Object} [options]
   * @param {number} [options.min]     bottom of the scale (default 0)
   * @param {number} [options.max]     top of the scale (default 100)
   * @param {string} [options.label]   accessible name
   * @param {string} [options.format]  (value) => string, used in the summary
   * @param {boolean} [options.markers] show the per-point dots (default true)
   */
  App.lineChart = function (points, options) {
    const opts = options || {};
    const series = points || [];
    if (!series.length) return App.el('div');

    const min = opts.min === undefined ? 0 : Number(opts.min);
    const max = opts.max === undefined ? 100 : Number(opts.max);
    const span = (max - min) || 1;
    const format = opts.format || function (value) { return String(value); };

    /* One slot per gap, so the first and last points sit on the edges and a
       single point lands in the middle rather than off the left. */
    const stepX = series.length > 1 ? 100 / (series.length - 1) : 100;
    const xAt = function (index) { return series.length > 1 ? index * stepX : 50; };
    const yAt = function (value) {
      const clamped = Math.max(min, Math.min(max, Number(value) || 0));
      return 100 - ((clamped - min) / span) * 100;
    };

    const line = series.map(function (point, index) {
      return xAt(index).toFixed(2) + ',' + yAt(point.value).toFixed(2);
    }).join(' ');
    const area = '0,100 ' + line + ' ' + xAt(series.length - 1).toFixed(2) + ',100';

    const grid = App.el('g', { class: 'line-chart__grid' }, [
      App.el('line', { class: 'line-chart__grid-line', x1: '0', y1: yAt(max).toFixed(2), x2: '100', y2: yAt(max).toFixed(2) }),
      App.el('line', { class: 'line-chart__grid-line', x1: '0', y1: yAt(min).toFixed(2), x2: '100', y2: yAt(min).toFixed(2) })
    ]);

    const svg = App.el('svg', {
      class: 'line-chart__plot',
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      focusable: 'false',
      'aria-hidden': 'true'
    }, [
      grid,
      App.el('polygon', { class: 'line-chart__area', points: area }),
      App.el('polyline', { class: 'line-chart__line', points: line, 'vector-effect': 'non-scaling-stroke' })
    ]);

    /* Text layer, positioned in percentages so it tracks the plot exactly. */
    const markers = App.el('div', { class: 'line-chart__points' });
    const labels = App.el('div', { class: 'line-chart__labels' });
    series.forEach(function (point, index) {
      if (opts.markers !== false) {
        markers.appendChild(App.el('span', {
          class: 'line-chart__marker' + (point.highlight ? ' line-chart__marker--last' : ''),
          title: point.label + ': ' + format(point.value)
        })).style.left = xAt(index) + '%';
        markers.lastChild.style.top = yAt(point.value) + '%';
      }
      const label = App.el('span', { class: 'line-chart__label' }, [
        App.el('span', { class: 'line-chart__label-main', text: point.label }),
        App.el('span', { class: 'line-chart__label-value', text: format(point.value) })
      ]);
      labels.appendChild(label);
    });

    const summary = series.map(function (point) {
      return point.label + ' ' + format(point.value);
    }).join(', ');

    return App.el('div', {
      class: 'line-chart',
      role: 'img',
      'aria-label': (opts.label || 'Line chart') + '. ' + summary
    }, [
      App.el('div', { class: 'line-chart__canvas' }, [svg, markers]),
      labels
    ]);
  };

  /** Labelled progress bar row. */
  App.meter = function (options) {
    const opts = options || {};
    const percent = Math.max(0, Math.min(100, Number(opts.percent) || 0));
    const bar = App.el('div', {
      class: 'progress__bar' + (opts.tone ? ' progress__bar--' + opts.tone : ''),
      role: 'progressbar',
      'aria-valuenow': String(Math.round(percent)),
      'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': opts.label
    });
    bar.style.width = percent + '%';
    return App.el('div', { class: 'meter-row' }, [
      App.el('span', { class: 'meter-row__label', text: opts.label }),
      App.el('div', { class: 'progress' }, [bar]),
      App.el('span', { class: 'meter-row__value', text: opts.text || percent.toFixed(1) + '%' })
    ]);
  };

  /** CSS donut used for fee collection. */
  App.donut = function (percent, centerText, centerLabel) {
    const donut = App.el('div', {
      class: 'donut', role: 'img',
      'aria-label': (centerLabel || 'Progress') + ': ' + percent + '%'
    }, [
      App.el('div', { class: 'donut__hole' }, [
        App.el('span', {}, [
          App.el('span', { class: 'donut__value', text: centerText }),
          App.el('span', { class: 'donut__label', text: centerLabel })
        ])
      ])
    ]);
    donut.style.setProperty('--value', percent);
    return donut;
  };

  /** Vertical bar chart (pure CSS, no library). */
  App.barChart = function (items, options) {
    const opts = options || {};
    const max = Math.max.apply(null, items.map(function (item) { return Number(item.value) || 0; })) || 1;
    const chart = App.el('div', { class: 'bar-chart', role: 'img', 'aria-label': opts.label || 'Bar chart' });
    items.forEach(function (item) {
      const height = Math.max(2, Math.round(((Number(item.value) || 0) / max) * 100));
      chart.appendChild(App.el('div', { class: 'bar-chart__col' }, [
        App.el('span', { class: 'bar-chart__label', text: item.short || item.label }),
        App.el('div', {
          class: 'bar-chart__bar',
          style: 'height:' + height + '%',
          title: item.label + ': ' + (opts.format ? opts.format(item.value) : item.value)
        })
      ]));
    });
    return chart;
  };

  /** Definition list of label/value pairs. */
  App.metaList = function (pairs) {
    const list = App.el('dl', { class: 'meta-list' });
    pairs.forEach(function (pair) {
      list.appendChild(App.el('div', { class: 'meta-list__row' }, [
        App.el('dt', { text: pair[0] }),
        App.el('dd', { text: pair[1] === undefined || pair[1] === null || pair[1] === '' ? '—' : String(pair[1]) })
      ]));
    });
    return list;
  };

  /**
   * Standard page note for modules that arrive in a later build step.
   * Keeps every navigation link working from day one.
   */
  App.moduleNote = function (pageName, description) {
    return App.el('div', { class: 'placeholder-note' }, [
      App.iconNode('info'),
      App.el('div', {}, [
        App.el('strong', { text: pageName + ' workspace' }),
        App.el('p', { text: description }),
        App.el('p', {
          class: 'text-muted text-xs',
          text: 'The demo data this page will use is already available: see the '
            + 'SchoolData global in js/data.js (helpers listed in the README).'
        })
      ])
    ]);
  };

  /** Mounts a module note into a container (used by pages built in later steps). */
  App.modulePlaceholder = function (selector, title, message) {
    const mount = App.qs(selector);
    if (!mount) return;
    App.clear(mount);
    mount.appendChild(App.moduleNote(title, message));
  };

  /** Renders a row of "at a glance" chips from shared demo data. */
  App.renderFacts = function (selector, facts) {
    const mount = App.qs(selector);
    if (!mount) return;
    App.clear(mount);
    (facts || []).forEach(function (fact) {
      mount.appendChild(App.el('span', { class: 'chip' }, [
        App.el('strong', { text: fact.label + ': ' }),
        App.el('span', { text: fact.value })
      ]));
    });
  };

  App.queryParam = function (name) {
    const value = new URLSearchParams(global.location.search).get(name);
    return value === null ? '' : value;
  };

  /* =========================================================================
   * 9. SETTINGS PREFERENCES (density + collapsed sidebar)
   * ====================================================================== */
  App.settings = {
    get: function () {
      return Object.assign({
        density: 'comfortable',
        sidebar: 'expanded',
        rowsPerPage: 25,
        feeReminder: true,
        attendanceAlert: true
      }, App.storage.get('settings', {}));
    },
    save: function (settings) {
      App.storage.set('settings', settings);
      App.applyPreferences();
    },
    apply: function () { App.applyPreferences(); }
  };

  App.applyPreferences = function () {
    const settings = App.settings.get();
    const root = document.documentElement;
    root.setAttribute('data-density', settings.density === 'compact' ? 'compact' : 'comfortable');
    root.setAttribute('data-sidebar', settings.sidebar === 'collapsed' ? 'collapsed' : 'expanded');
  };

  /* =========================================================================
   * 10. BOOT
   *
   * `booted` makes boot() idempotent. Without it, anything that can fire
   * DOMContentLoaded a second time (a late-injected script, a test harness, a
   * page that accidentally includes app.js twice) would mount a *second*
   * sidebar and topbar into the same document.
   * ====================================================================== */
  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;
    App.applyPreferences();
    App.mountShell();
    document.dispatchEvent(new CustomEvent('app:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.App = App;

}(window));