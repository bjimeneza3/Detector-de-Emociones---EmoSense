(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try { preference = localStorage.getItem('emosense-theme'); } catch {}
  if (!['light','dark'].includes(preference)) preference = null;
  function apply(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    const button = document.querySelector('#theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed',String(dark));
      button.setAttribute('aria-label',dark ? 'Activar modo claro' : 'Activar modo oscuro');
      document.querySelector('#theme-icon').textContent = dark ? '☀' : '☾';
      document.querySelector('#theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark ? '#171420' : '#f8f7fc');
  }
  apply(preference || (systemTheme.matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded',() => {
    apply(root.dataset.theme);
    document.querySelector('#theme-toggle')?.addEventListener('click',() => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('emosense-theme',preference); } catch {}
      apply(preference);
    });
  });
  systemTheme.addEventListener('change',event => {
    if (!preference) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage',event => {
    if (event.key !== 'emosense-theme') return;
    preference = ['light','dark'].includes(event.newValue) ? event.newValue : null;
    apply(preference || (systemTheme.matches ? 'dark' : 'light'));
  });
})();
