document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = getApiBase();
  const form = document.getElementById('resetForm');
  const message = document.getElementById('resetMessage');
  const intro = document.getElementById('resetIntroMessage');
  const TOKEN_KEY = 'sigac_auth_token';
  const params = new URLSearchParams(window.location.search);
  const temporaryMode = params.get('mode') === 'temporary';

  function show(text, type) {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');
  }

  function getApiBase() {
    const isSameBackend = window.location.protocol.startsWith('http')
      && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && window.location.port === '3000';

    if (isSameBackend) return '';

    const host = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? window.location.hostname
      : 'localhost';

    return `http://${host}:3000`;
  }

  async function requestJson(url, options = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
    } catch (_) {
      throw new Error('Não foi possível conectar ao servidor. Abra o SIGAC em localhost:3000 ou mantenha o servidor ligado.');
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível alterar a senha.');
    }

    return payload;
  }

  function disableFormForDirectAccess() {
    if (!form) return;
    form.querySelectorAll('input, button[type="submit"]').forEach((element) => {
      element.disabled = true;
    });
    if (intro) {
      intro.textContent = 'Recuperação por token foi desativada por segurança. Solicite ao administrador ou coordenador uma senha temporária e faça login normalmente. Depois disso, o SIGAC abrirá esta tela para cadastrar a senha definitiva.';
      intro.className = 'message warning';
    }
    show('Por segurança, esta tela não gera token e não troca senha só pelo e-mail.', 'info');
  }

  const sessionToken = localStorage.getItem(TOKEN_KEY) || '';
  if (!temporaryMode || !sessionToken) {
    disableFormForDirectAccess();
    return;
  }

  if (intro) {
    intro.textContent = 'Primeiro acesso: cadastre uma senha definitiva. A senha temporária deixará de valer após salvar.';
    intro.className = 'message info';
  }
  show('Sessão temporária encontrada. Defina sua nova senha para continuar.', 'info');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmarSenha').value;

    if (senha !== confirmar) {
      show('As senhas não coincidem.', 'error');
      return;
    }

    try {
      await requestJson('/api/auth/change-temporary-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ senha, confirmar })
      });
      localStorage.removeItem(TOKEN_KEY);
      show('Senha definitiva cadastrada com sucesso. Faça login novamente.', 'success');
      setTimeout(() => {
        window.location.href = 'loginsigac.html';
      }, 1200);
    } catch (error) {
      show(error.message, 'error');
    }
  });
});
