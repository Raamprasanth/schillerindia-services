(function () {
  const LOGO_SRC = 'logo.png';
  const LOGO_ALT = 'SCHILLER';

  function logoMarkup() {
    return '<img class="brand-logo-img" src="' + LOGO_SRC + '" alt="' + LOGO_ALT + '">';
  }

  function replaceLogo(container) {
    if (!container || container.dataset.brandLogoApplied === 'true') return;
    container.dataset.brandLogoApplied = 'true';
    container.classList.add('brand-logo-host');
    container.innerHTML = logoMarkup();
  }

  function normalizeLogos() {

    document.querySelectorAll('.sidebar-logo-icon, .logo-icon').forEach((logo) => {
      const container = logo.closest('.sidebar-logo, .logo-wrap') || logo.parentElement;
      replaceLogo(container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeLogos);
  } else {
    normalizeLogos();
  }
})();
