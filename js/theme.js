(function () {
  const STORAGE_KEY = 'sigac-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === DARK ? DARK : LIGHT;
    } catch (error) {
      return LIGHT;
    }
  }

  function setMetaColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === DARK ? '#0f172a' : '#ffffff');
  }

  function applyTheme(theme) {
    const normalized = theme === DARK ? DARK : LIGHT;
    document.documentElement.dataset.theme = normalized;
    setMetaColor(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (error) {}

    window.dispatchEvent(new CustomEvent('sigac:themechange', { detail: { theme: normalized } }));

    document.querySelectorAll('#themeToggle').forEach((button) => {
      const isDark = normalized === DARK;
      button.setAttribute('aria-pressed', String(isDark));
      const label = button.querySelector('.theme-toggle-label');
      const icon = button.querySelector('.theme-toggle-icon');
      if (label) label.textContent = isDark ? 'Modo claro' : 'Modo escuro';
      if (icon) icon.textContent = isDark ? '☀' : '☾';
      button.title = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
    });
  }

  applyTheme(getStoredTheme());

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getStoredTheme());
    document.querySelectorAll('#themeToggle').forEach((button) => {
      button.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme === DARK ? DARK : LIGHT;
        applyTheme(current === DARK ? LIGHT : DARK);
      });
    });
  });
})();
