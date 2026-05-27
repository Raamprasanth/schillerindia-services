(function () {
  const KEY = 'si_employee_theme';
  const ACTIVE_DIVISION_KEY = 'schiller_active_division';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem('schiller_user') || '{}') || {};
    } catch (_err) {
      return {};
    }
  }

  function getAssignedDivisions(user = readUser()) {
    const values = Array.isArray(user.divisions) ? [...user.divisions] : [];
    if (user.division) values.push(user.division);
    if (Array.isArray(user.assignedDivisions)) values.push(...user.assignedDivisions);
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
  }

  function isServiceUser(user = readUser()) {
    const role = String(user.role || sessionStorage.getItem('schiller_role') || '').toLowerCase();
    return role === 'employee' || role === 'service_team' || String(user._collection || '') === 'Employee';
  }

  function getActiveDivision() {
    const user = readUser();
    const assigned = getAssignedDivisions(user);
    const stored = String(localStorage.getItem(ACTIVE_DIVISION_KEY) || '').trim();
    const match = assigned.find(d => d.toLowerCase() === stored.toLowerCase());
    if (match) return match;
    const fallback = assigned[0] || String(user.division || '').trim();
    if (fallback) localStorage.setItem(ACTIVE_DIVISION_KEY, fallback);
    return fallback;
  }

  function patchFetchForActiveDivision() {
    if (window.__schillerActiveDivisionFetchPatched) return;
    window.__schillerActiveDivisionFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const activeDivision = getActiveDivision();
      if (!activeDivision || !isServiceUser()) return nativeFetch(input, init);

      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const isApi = /^\/api\//.test(url) || (() => {
        try {
          const parsed = new URL(url, window.location.origin);
          return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
        } catch (_err) {
          return false;
        }
      })();

      const headers = new Headers(init.headers || (typeof input !== 'string' && input ? input.headers : undefined) || {});
      const hasAuth = headers.has('Authorization') || headers.has('authorization');
      if (!isApi && !hasAuth) return nativeFetch(input, init);
      headers.set('X-Active-Division', activeDivision);
      return nativeFetch(input, { ...init, headers });
    };
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-emp-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
  }

  function init() {
    const stored = localStorage.getItem(KEY) || localStorage.getItem('si_theme') || 'light';
    applyTheme(stored);
    sanitizeCorruptTableMarks();
    removeActivityUi();
    enableDatePickerTabFlow();
    enableDateEnterShortcut();
    initDivisionSwitcher();
    setTimeout(removeActivityUi, 300);
  }

  function initDivisionSwitcher() {
    patchFetchForActiveDivision();
    const user = readUser();
    if (!isServiceUser(user)) return;
    const assigned = getAssignedDivisions(user);
    if (assigned.length < 2) {
      if (assigned[0]) localStorage.setItem(ACTIVE_DIVISION_KEY, assigned[0]);
      return;
    }
    const profileDept = document.getElementById('profile-dept');
    const active = getActiveDivision();
    if (profileDept && active) {
      const text = profileDept.textContent || '';
      profileDept.textContent = text.includes(' - ') ? text.replace(/ - .*$/, ` - ${active} Division`) : `${text} - ${active} Division`;
    }
  }

  function sanitizeCorruptTableMarks() {
    document.querySelectorAll('th').forEach((th) => {
      if (!th.hasAttribute('onclick')) return;
      const text = th.textContent || '';
      if (!/\?\s*$/.test(text)) return;
      th.textContent = text.replace(/\s*\?\s*$/, ' ');
      const marker = document.createElement('span');
      marker.className = 'si';
      marker.innerHTML = '&#8597;';
      th.appendChild(marker);
    });
    document.querySelectorAll('tbody td, tbody button, tbody span').forEach((el) => {
      if (el.children.length) return;
      const text = el.textContent || '';
      if (!/^\?{1,2}\s+/.test(text)) return;
      el.textContent = text.replace(/^\?{1,2}\s+/, '');
    });
  }

  function removeActivityUi() {
    const directSelectors = [
      'a[href*="pending-activity"]',
      'a[href*="closed-activity"]',
      'a[href*="pt-pending-activity"]',
      'a[href*="pt-closed-activity"]',
      'a[href*="fqc-pending-activity"]',
      'a[href*="fqc-closed-activity"]',
      'a[href*="fqc.html?page=pending-activity"]',
      'a[href*="fqc.html?page=closed-activity"]',
      'button[data-page="pending-activity"]',
      'button[data-page="closed-activity"]',
      '#page-pending-activity',
      '#page-closed-activity'
    ];
    directSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    });

    const labels = ['Pending Activity', 'Closed Activity'];
    const removableSelectors = ['.nav-item', '.quick-link', '.stat-card', '.panel', '.panel-action', '.modal-tab'];
    removableSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const anchor = node.tagName === 'A' ? node : node.querySelector('a');
        const href = anchor ? (anchor.getAttribute('href') || '') : '';
        if (anchor && (/^Rt[a-z]/i.test(href) || href.includes('ptpa.html') || href.includes('ptca.html') || href.includes('epa.html') || href.includes('ecpa.html'))) return;
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (!labels.some((label) => text.includes(label))) return;
        if (selector === '.panel') {
          const title = node.querySelector('.panel-title');
          const titleText = (title && title.textContent ? title.textContent : '').replace(/\s+/g, ' ').trim();
          if (!labels.some((label) => titleText.includes(label))) return;
        }
        node.remove();
      });
    });
  }

  function enableDatePickerTabFlow() {
    if (window.__schillerDateTabFlowEnabled) return;
    window.__schillerDateTabFlowEnabled = true;

    const focusableSelector = [
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'button',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function getFocusableElements() {
      return Array.from(document.querySelectorAll(focusableSelector))
        .filter(el => !el.disabled && !el.readOnly && isVisible(el));
    }

    function focusNextFrom(el, backwards = false) {
      const focusables = getFocusableElements();
      const currentIndex = focusables.indexOf(el);
      if (currentIndex === -1) return false;
      const next = focusables[currentIndex + (backwards ? -1 : 1)];
      if (!next) return false;
      next.focus();
      if (typeof next.select === 'function' && /^(text|search|tel|url|email|number)$/i.test(next.type || '')) {
        try { next.select(); } catch (_err) {}
      }
      return true;
    }

    document.addEventListener('keydown', (e) => {
      const el = e.target;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'date') return;
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (!String(el.value || '').trim()) return;
      if (focusNextFrom(el, e.shiftKey)) e.preventDefault();
    }, true);
  }

  function enableDateEnterShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT' && active.type === 'date') {
          e.preventDefault();
          // Ensure it's not readonly or disabled
          if (!active.readOnly && !active.disabled) {
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            active.value = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
            active.dispatchEvent(new Event('change', { bubbles: true }));
            active.dispatchEvent(new Event('input', { bubbles: true }));
            active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
          }
        }
      }
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .active-division-switch{display:inline-flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border,#dbe5ee);border-radius:8px;background:var(--surface,#fff);font-size:12px;font-weight:700;color:var(--soft,#3d6480);white-space:nowrap}
    .active-division-switch select{height:30px;border:1px solid var(--border,#dbe5ee);border-radius:7px;background:var(--surface2,#f5f9fc);color:var(--text,#0f2236);font-size:12px;font-weight:700;padding:0 28px 0 8px;outline:none}
  `;
  document.head.appendChild(style);

  patchFetchForActiveDivision();

  const initialTheme = localStorage.getItem(KEY) || localStorage.getItem('si_theme') || 'light';
  document.documentElement.setAttribute('data-emp-theme', initialTheme === 'dark' ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initialTheme === 'dark' ? 'dark' : 'light');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
