document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const message = document.getElementById('loginMessage');

  function show(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const user = SIGACStore.login(
        document.getElementById('email').value,
        document.getElementById('senha').value
      );
      show(`Sucesso! Bem-vindo, ${user.nome}.`, 'success');
      const routes = {
        superadmin: 'adminsigac.html',
        coordenador: 'coordenador.html',
        aluno: 'index.html'
      };
      setTimeout(() => {
        window.location.href = routes[user.tipo] || 'index.html';
      }, 600);
    } catch (error) {
      show(error.message, 'error');
    }
  });
});
