// tab-fix.js — When Tab/Shift+Tab lands focus on a date input, open its
// calendar picker immediately. After picking a date, advance to the next field.
(function () {
  var tabDir    = 0;     // 1 = Tab forward, -1 = Shift+Tab backward, 0 = other
  var tabPickEl = null;  // date input whose picker was opened via Tab
  var tabPickBk = false; // whether we arrived via Shift+Tab

  function focusable() {
    return Array.from(
      document.querySelectorAll('input, select, textarea, button, [tabindex]')
    ).filter(function (el) {
      if (el.disabled || el.tabIndex < 0) return false;
      if (el.offsetParent === null)        return false;
      var s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
  }

  function advance(el, back) {
    var list = focusable();
    var i    = list.indexOf(el);
    if (i === -1) return;
    var next = list[back ? i - 1 : i + 1];
    if (next) next.focus();
  }

  /* ── 1. Capture Tab direction before anything else fires ─── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') tabDir = e.shiftKey ? -1 : 1;
  }, true);

  /* ── 2. When Tab is pressed while a date input is focused:
         move to next/prev field (let focusin handle the picker) ── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !e.target || e.target.type !== 'date') return;
    e.preventDefault();
    tabPickEl = null;
    advance(e.target, e.shiftKey);
  });

  /* ── 3. When focus ARRIVES at a date input via Tab:
         open that input's calendar picker ─────────────────────── */
  document.addEventListener('focusin', function (e) {
    if (!e.target || e.target.type !== 'date' || tabDir === 0) return;
    var dir   = tabDir;
    tabDir    = 0;      // consume so mouse-clicks don't trigger picker
    tabPickEl = e.target;
    tabPickBk = (dir === -1);
    var el    = e.target;
    setTimeout(function () {
      if (!el.showPicker) { tabPickEl = null; return; }
      try { el.showPicker(); }
      catch (err) { tabPickEl = null; }
    }, 0);
  });

  /* ── 4. After picking a date: auto-advance in Tab direction ── */
  // Removed auto-advance on 'change' to prevent distracting focus jumps while typing dates with the keyboard.
})();
