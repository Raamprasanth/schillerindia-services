// tab-fix.js — Date input field tab navigation override.
// Intercepts Tab and Shift keys inside date inputs to directly move focus to the next/previous form field,
// bypassing the browser's default behavior of sub-tab navigation inside the day/month/year parts.
(function () {
  let shiftPressedOnTarget = null;
  let otherKeyPressed = false;

  // Track keydown on document body to catch bubbles
  document.addEventListener('keydown', function (e) {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'date') {
      if (e.key === 'Shift') {
        shiftPressedOnTarget = target;
        otherKeyPressed = false;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        moveFocus(target, e.shiftKey ? -1 : 1);
        otherKeyPressed = true;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        target.value = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
        
        // Trigger input/change events so other JS logic knows the value updated
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        
        otherKeyPressed = true;
      } else {
        otherKeyPressed = true;
      }
    }
  });

  // Track keyup for Shift key by itself
  document.addEventListener('keyup', function (e) {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'date') {
      if (e.key === 'Shift') {
        if (shiftPressedOnTarget === target && !otherKeyPressed) {
          // If only the Shift key was pressed and released inside the date box
          moveFocus(target, 1);
        }
        shiftPressedOnTarget = null;
      }
    }
  });

  // Function to move focus to the next/previous visible and enabled focusable element
  function moveFocus(target, direction) {
    const focusables = Array.from(document.querySelectorAll('input, select, textarea, button, [tabindex]'))
      .filter(el => {
        // Exclude disabled elements
        if (el.disabled) return false;
        
        // Exclude hidden inputs
        if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
        
        // Exclude tabIndex = -1
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') === '-1') return false;
        
        // Exclude elements with style display: none or visibility: hidden
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        
        // Exclude elements that have 0 width/height (not visible/rendered)
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
        
        return true;
      });

    const index = focusables.indexOf(target);
    if (index !== -1) {
      let nextIndex = index + direction;
      if (nextIndex >= focusables.length) {
        nextIndex = 0;
      } else if (nextIndex < 0) {
        nextIndex = focusables.length - 1;
      }
      
      const nextEl = focusables[nextIndex];
      if (nextEl) {
        nextEl.focus();
        if (nextEl.tagName === 'INPUT' && typeof nextEl.select === 'function') {
          nextEl.select();
        }
      }
    }
  }
})();

if (typeof window.toggleGroup !== 'function') {
  window.toggleGroup = function (toggleId, panelId) {
    var btn = document.getElementById(toggleId);
    var panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    btn.classList.toggle('open');
    panel.classList.toggle('open');
  };
}

if (typeof window.toggleRTA !== 'function') {
  window.toggleRTA = function () {
    window.toggleGroup('rta-toggle', 'rta-children');
  };
}
