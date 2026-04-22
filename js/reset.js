document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetForm');
  const message = document.getElementById('resetMessage');

  function show(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmarSenha').value;

    if (senha !== confirmar) {
      show('As senhas não coincidem.', 'error');
      return;
    }

    try {
      SIGACStore.resetPassword(email, senha);
      show('Senha alterada com sucesso. Um e-mail simulado foi registrado no sistema.', 'success');
      setTimeout(() => {
        window.location.href = 'loginsigac.html';
      }, 1200);
    } catch (error) {
      show(error.message, 'error');
    }
  });
});
