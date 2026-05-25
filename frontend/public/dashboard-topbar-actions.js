(function () {
  const themeKeys = ['si_employee_theme', 'si_theme'];

  function currentTheme() {
    return (
      localStorage.getItem('si_employee_theme') ||
      localStorage.getItem('si_theme') ||
      document.documentElement.getAttribute('data-theme') ||
      'light'
    ) === 'dark'
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-emp-theme', next);
    themeKeys.forEach((key) => localStorage.setItem(key, next));
    updateThemeButtons(next);
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll('[data-dashboard-theme-btn]').forEach((button) => {
      const dark = theme === 'dark';
      button.innerHTML = dark ? '&#9728;&#65039;' : '&#127769;';
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', button.title);
    });
  }

  function addButtons() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || topbar.querySelector('[data-dashboard-actions]')) return;

    const target =
      topbar.querySelector('.topbar-actions') ||
      topbar.querySelector('.topbar-right') ||
      topbar.lastElementChild ||
      topbar;

    const group = document.createElement('div');
    group.className = 'dashboard-topbar-actions';
    group.setAttribute('data-dashboard-actions', 'true');
    group.innerHTML = [
      '<button type="button" class="dashboard-topbar-action" data-dashboard-theme-btn onclick="window.toggleDashboardTheme()" aria-label="Toggle dark mode"></button>',
    ].join('');

    target.prepend(group);
    updateThemeButtons(currentTheme());
  }

  window.toggleDashboardTheme = function () {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  };

  applyTheme(currentTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButtons);
  } else {
    addButtons();
  }
})();
