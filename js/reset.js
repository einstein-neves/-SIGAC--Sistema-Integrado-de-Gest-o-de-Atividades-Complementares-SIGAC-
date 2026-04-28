document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = getApiBase();
  const form = document.getElementById('resetForm');
  const message = document.getElementById('resetMessage');
  const requestButton = document.getElementById('requestResetToken');
  const tokenInput = document.getElementById('resetToken');

  function show(text, type) {
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

  const initialToken = new URLSearchParams(window.location.search).get('token');
  if (initialToken) {
    tokenInput.value = initialToken;
  }

  requestButton.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) {
      show('Informe o e-mail cadastrado para receber o token.', 'error');
      return;
    }

    try {
      requestButton.disabled = true;
      await requestJson('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      show('Se o e-mail existir e estiver ativo, o token foi enviado.', 'success');
    } catch (error) {
      show(error.message, 'error');
    } finally {
      requestButton.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = tokenInput.value.trim();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmarSenha').value;

    if (senha !== confirmar) {
      show('As senhas não coincidem.', 'error');
      return;
    }

    try {
      await requestJson('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, senha })
      });

      show('Senha alterada com sucesso.', 'success');
      setTimeout(() => {
        window.location.href = 'loginsigac.html';
      }, 1200);
    } catch (error) {
      show(error.message, 'error');
    }
  });
});
