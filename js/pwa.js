(function () {
  'use strict';

  function ensureBanner() {
    let banner = document.getElementById('pwaStatusBanner');
    if (banner) return banner;

    banner = document.createElement('div');
    banner.id = 'pwaStatusBanner';
    banner.className = 'pwa-status hidden';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.appendChild(banner);
    return banner;
  }

  function setOfflineState() {
    const banner = ensureBanner();
    if (navigator.onLine === false) {
      banner.textContent = 'Voce esta offline. O SIGAC continua aberto, mas consultas e envios dependem da API.';
      banner.classList.remove('hidden');
      return;
    }
    banner.textContent = '';
    banner.classList.add('hidden');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }

  window.addEventListener('online', setOfflineState);
  window.addEventListener('offline', setOfflineState);
  document.addEventListener('DOMContentLoaded', setOfflineState);
})();
