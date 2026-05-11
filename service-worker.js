
const CACHE_VERSION = 'sigac-matricula-sem-token-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Cache estatico seguro: somente arquivos publicos de interface, assets,
// manifest, icones e bibliotecas locais. Dados privados ficam fora.
const STATIC_ASSETS = [
  '/',
  '/loginsigac.html',
  '/index.html',
  '/coordenador.html',
  '/adminsigac.html',
  '/resetarsenha.html',
  '/sigac.css',
  '/manifest.json',
  '/Logo SIGAC-otimizada.png',
  '/Logo SIGAC.png',
  '/favicon-sigac.png',
  '/icons/sigac-icon-192.png',
  '/icons/sigac-icon-512.png',
  '/js/data.js',
  '/js/login.js',
  '/js/theme.js',
  '/js/index.js',
  '/js/admin.js',
  '/js/coordenador.js',
  '/js/ocr.js',
  '/js/reset.js',
  '/js/custom-select.js',
  '/vendor/chart.umd.min.js'
];

const OFFLINE_API_RESPONSE = {
  error: 'Voce esta offline ou a API do SIGAC esta indisponivel. Os dados dinamicos serao atualizados quando a conexao voltar.'
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // Limpa caches antigos quando a versao muda para evitar assets vencidos.
        .filter((key) => key.startsWith('sigac-') && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // API sempre via rede: nao gravamos respostas autenticadas ou dados de usuario.
    // Em falha de rede, devolvemos erro amigavel para o frontend tratar sem travar.
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify(OFFLINE_API_RESPONSE), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }))
    );
    return;
  }

  event.respondWith(
    // Assets publicos usam cache-first com atualizacao sob demanda via nova versao.
    caches.match(request)
      .then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
      .catch(() => caches.match('/loginsigac.html'))
  );
});
