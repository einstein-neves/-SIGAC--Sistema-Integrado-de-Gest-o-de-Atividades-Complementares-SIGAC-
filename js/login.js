document.addEventListener('DOMContentLoaded', () => {
  const TOKEN_KEY = 'sigac_auth_token';
  const API_BASE = getApiBase();
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginMessage = document.getElementById('loginMessage');
  const registerMessage = document.getElementById('registerMessage');
  const courseSelect = document.getElementById('registerCourse');
  const loginRoleSelect = document.getElementById('loginRole');
  const tabs = [...document.querySelectorAll('.auth-tab')];
  const panels = [...document.querySelectorAll('.auth-panel')];
  const routes = {
    superadmin: 'adminsigac.html',
    coordenador: 'coordenador.html',
    aluno: 'index.html'
  };

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

  function show(target, text, type) {
    target.textContent = text;
    target.className = `message ${type}`;
    target.classList.remove('hidden');
  }

  function hide(target) {
    target.textContent = '';
    target.className = 'message info hidden';
  }

  function setActivePanel(panelId) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.authTarget === panelId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== panelId);
    });

    hide(loginMessage);
    if (registerMessage) hide(registerMessage);
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
      throw new Error(payload.error || 'Não foi possível concluir a solicitação. Verifique se o backend do SIGAC está em execução.');
    }

    return payload;
  }

  function saveToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }

  function populateCourses(courses) {
    if (!courseSelect) return;
    if (!courses.length) {
      courseSelect.innerHTML = '<option value="">Nenhum curso disponível</option>';
      courseSelect.disabled = true;
      return;
    }

    courseSelect.disabled = false;
    courseSelect.innerHTML = [
      '<option value="">Selecione um curso</option>',
      ...courses.map((course) => `<option value="${course.id}">${course.sigla} - ${course.nome}</option>`)
    ].join('');
  }

  async function loadCourses() {
    if (!courseSelect) return;
    try {
      const data = await requestJson('/api/public/courses');
      populateCourses(data.courses || []);
    } catch (error) {
      courseSelect.innerHTML = `<option value="">${error.message}</option>`;
      courseSelect.disabled = true;
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.authTarget));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hide(loginMessage);

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const selectedRole = loginRoleSelect?.value || '';

    try {
      const data = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha })
      });
      saveToken(data.token);
      if (selectedRole && data.user.tipo !== selectedRole) {
        if (loginRoleSelect) loginRoleSelect.value = data.user.tipo;
        show(loginMessage, `Login realizado com sucesso. O acesso correto para este usuário é ${data.user.tipo}. Redirecionando...`, 'info');
      } else {
        show(loginMessage, `Sucesso! Bem-vindo, ${data.user.nome}.`, 'success');
      }
      setTimeout(() => {
        window.location.href = routes[data.user.tipo] || 'index.html';
      }, 600);
    } catch (error) {
      show(loginMessage, error.message, 'error');
    }
  });

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      hide(registerMessage);

      const nome = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const courseId = courseSelect.value;
      const senha = document.getElementById('registerPassword').value;
      const confirmar = document.getElementById('registerPasswordConfirm').value;

      if (senha !== confirmar) {
        show(registerMessage, 'As senhas não coincidem.', 'error');
        return;
      }

      try {
        await requestJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ nome, email, senha, courseId })
        });
        registerForm.reset();
        await loadCourses();
        document.getElementById('email').value = email;
        document.getElementById('senha').value = senha;
        setActivePanel('loginPanel');
        show(loginMessage, 'Cadastro realizado com sucesso. Agora faça seu login.', 'success');
      } catch (error) {
        show(registerMessage, error.message, 'error');
      }
    });
  }

  setActivePanel('loginPanel');
  loadCourses();
});
