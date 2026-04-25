document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = getApiBase();
  const form = document.getElementById('resetForm');
  const message = document.getElementById('resetMessage');

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
      throw new Error('Nao foi possivel conectar ao servidor. Abra pelo SIGAC em localhost:3000 ou deixe o servidor ligado.');
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.error || 'Nao foi possivel alterar a senha.');
    }

    return payload;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmarSenha').value;

    if (senha !== confirmar) {
      show('As senhas nao coincidem.', 'error');
      return;
    }

    try {
      await requestJson('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, senha })
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
