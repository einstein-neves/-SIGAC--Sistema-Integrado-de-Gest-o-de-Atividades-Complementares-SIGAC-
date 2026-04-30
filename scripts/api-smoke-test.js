const BASE_URL = String(process.env.SIGAC_TEST_BASE_URL || '').replace(/\/+$/, '');
const ADMIN_EMAIL = String(process.env.SIGAC_TEST_ADMIN_EMAIL || '').trim();
const ADMIN_PASSWORD = String(process.env.SIGAC_TEST_ADMIN_PASSWORD || '').trim();

function fail(message) {
  console.error(`[SIGAC API Smoke] ${message}`);
  process.exit(1);
}

async function request(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    let body = {};
    try {
      body = await response.json();
    } catch (_) {
      body = {};
    }
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  if (!BASE_URL) {
    console.log('[SIGAC API Smoke] SIGAC_TEST_BASE_URL nao definido; testes funcionais de API foram ignorados com seguranca.');
    return;
  }

  let result = await request('/api/public/courses');
  if (result.response.status !== 200 || !Array.isArray(result.body.courses)) {
    fail('GET /api/public/courses deveria retornar 200 com lista de cursos.');
  }

  result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalido@example.com', senha: 'senha-incorreta' })
  });
  if (result.response.status !== 401) fail('Login com credenciais invalidas deveria retornar 401.');

  result = await request('/api/admin/dashboard/summary');
  if (result.response.status !== 401) fail('Rota administrativa sem token deveria retornar 401.');

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, senha: ADMIN_PASSWORD })
    });
    if (result.response.status !== 200 || !result.body.token) fail('Login Super Admin de teste deveria retornar token.');

    const token = result.body.token;
    result = await request('/api/courses', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (result.response.status !== 200 || !Array.isArray(result.body.courses)) {
      fail('GET /api/courses autenticado deveria retornar lista de cursos.');
    }

    result = await request('/api/coordinator/dashboard/summary', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (result.response.status !== 403) fail('Super Admin nao deveria acessar dashboard exclusivo do Coordenador.');
  } else {
    console.log('[SIGAC API Smoke] Credenciais de teste nao definidas; testes autenticados opcionais ignorados.');
  }

  console.log('[SIGAC API Smoke] Testes funcionais basicos concluidos com sucesso.');
}

main().catch((error) => fail(error.message || 'Falha inesperada no smoke test da API.'));
