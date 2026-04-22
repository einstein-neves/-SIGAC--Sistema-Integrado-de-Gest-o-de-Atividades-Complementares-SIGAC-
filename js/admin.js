(function () {
  'use strict';

  let chartApproval = null;
  let chartStatus = null;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';

  function showMessage(id, text, type) {
    const box = document.getElementById(id);
    box.textContent = text;
    box.className = `message ${type}`;
    box.classList.remove('hidden');
  }

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  }

  function renderCharts(data) {
    if (!window.Chart) return;
    const approvalCtx = document.getElementById('chartAprovacaoCursos').getContext('2d');
    const statusCtx = document.getElementById('chartPendencias').getContext('2d');
    if (chartApproval) chartApproval.destroy();
    if (chartStatus) chartStatus.destroy();

    chartApproval = new Chart(approvalCtx, {
      type: 'bar',
      data: {
        labels: data.courses.map((course) => course.sigla),
        datasets: [{ label: '% aprovação', data: data.courses.map((course) => course.taxaAprovacao) }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pendentes', 'Aprovados', 'Rejeitados'],
        datasets: [{ data: [data.totals.pendentes, data.totals.aprovados, data.totals.rejeitados] }]
      }
    });
  }

  function populateSharedSelects() {
    const users = SIGACStore.listUsers();
    const courses = SIGACStore.listCourses();
    const students = users.filter((user) => user.tipo === 'aluno');
    const coordinators = users.filter((user) => user.tipo === 'coordenador');

    const courseOptions = courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    const studentOptions = students.map((student) => `<option value="${student.id}">${escapeHtml(student.nome)}</option>`).join('');
    const coordinatorOptions = coordinators.map((coord) => `<option value="${coord.id}">${escapeHtml(coord.nome)}</option>`).join('');

    ['userCourseInput', 'studentCourseSelect'].forEach((id) => {
      document.getElementById(id).innerHTML = `<option value="">Selecione...</option>${courseOptions}`;
    });
    ['userCoordinatorCoursesInput', 'coordinatorCoursesSelect'].forEach((id) => {
      document.getElementById(id).innerHTML = courseOptions;
    });
    document.getElementById('studentSelect').innerHTML = `<option value="">Selecione...</option>${studentOptions}`;
    document.getElementById('coordinatorSelect').innerHTML = `<option value="">Selecione...</option>${coordinatorOptions}`;

    document.getElementById('userTypeInput').addEventListener('change', (event) => {
      const type = event.target.value;
      document.getElementById('userCourseInput').disabled = type !== 'aluno';
      document.getElementById('userCoordinatorCoursesInput').disabled = type !== 'coordenador';
    });
    document.getElementById('userTypeInput').dispatchEvent(new Event('change'));
  }

  function renderDashboard() {
    const data = SIGACStore.getAdminDashboardData();
    document.getElementById('metricsGrid').innerHTML = `
      <div class="card"><h3>Cursos</h3><div class="metric-value">${data.totals.totalCursos}</div></div>
      <div class="card"><h3>Usuários ativos</h3><div class="metric-value">${data.totals.totalUsuarios}</div></div>
      <div class="card"><h3>Oportunidades</h3><div class="metric-value">${data.totals.totalOportunidades}</div></div>
      <div class="card"><h3>Envios pendentes</h3><div class="metric-value">${data.totals.pendentes}</div></div>
    `;

    document.getElementById('coursesDashboardList').innerHTML = data.courses.map((course) => `
      <div class="item">
        <h4>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</h4>
        <p class="meta">Área: ${escapeHtml(course.area)} | Turno: ${escapeHtml(course.turno)} | Meta: ${course.horasMeta}h</p>
        <p><strong>Total de alunos:</strong> ${course.totalAlunos}</p>
        ${course.students.length ? `
          <div class="small"><strong>Alunos:</strong> ${course.students.map((student) => `${escapeHtml(student.nome)} (${student.progress.total}/${student.progress.target}h)`).join(', ')}</div>
        ` : '<div class="small">Nenhum aluno vinculado.</div>'}
      </div>
    `).join('');

    renderCharts(data);
  }

  function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const users = SIGACStore.listUsers().filter((user) => user.tipo !== 'superadmin');
    tbody.innerHTML = users.map((user) => {
      const link = user.tipo === 'aluno'
        ? escapeHtml(SIGACStore.getCourseById(user.courseId)?.sigla || 'Sem curso')
        : (user.courseIds || []).map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', ') || 'Sem cursos';
      return `
        <tr>
          <td>${escapeHtml(user.nome)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.tipo)}</td>
          <td>${escapeHtml(link)}</td>
          <td>${user.ativo ? 'Ativo' : 'Inativo'}</td>
          <td><button class="toggle-status secondary" data-id="${user.id}" data-active="${user.ativo}">${user.ativo ? 'Desativar' : 'Ativar'}</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.toggle-status').forEach((button) => {
      button.addEventListener('click', () => {
        SIGACStore.updateUserStatus(button.dataset.id, button.dataset.active !== 'true');
        renderAll();
      });
    });
  }

  function renderCourses() {
    const courses = SIGACStore.getAdminDashboardData().courses;
    document.getElementById('coursesList').innerHTML = courses.map((course) => `
      <div class="item">
        <h4>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</h4>
        <p class="meta">Área: ${escapeHtml(course.area)} | Turno: ${escapeHtml(course.turno)} | Meta: ${course.horasMeta}h</p>
        <p><strong>Alunos:</strong> ${course.totalAlunos}</p>
      </div>
    `).join('');
  }

  function renderOpportunities() {
    const users = SIGACStore.listUsers();
    const opportunities = SIGACStore.listOpportunities();
    document.getElementById('opportunitiesAdminList').innerHTML = opportunities.length
      ? opportunities.map((opportunity) => `
          <div class="item">
            <h4>${escapeHtml(opportunity.titulo)}</h4>
            <p>${escapeHtml(opportunity.descricao)}</p>
            <p class="meta">Horas: ${opportunity.horas}h</p>
            <p class="small"><strong>Inscritos:</strong> ${opportunity.inscritos.length ? opportunity.inscritos.map((id) => escapeHtml(users.find((user) => user.id === id)?.nome || id)).join(', ') : 'Nenhum inscrito'}</p>
          </div>
        `).join('')
      : '<div class="item">Nenhuma oportunidade cadastrada.</div>';
  }

  function renderSettings() {
    const data = SIGACStore.getAdminDashboardData();
    document.getElementById('horasMeta').value = data.settings.horasMetaPadrao;
    document.getElementById('emailToggle').checked = !!data.settings.emailNotificationsEnabled;
    document.getElementById('downloadEmailLog').href = SIGACStore.exportEmailLog();
    document.getElementById('emailList').innerHTML = data.emails.length
      ? data.emails.slice(0, 10).map((mail) => `
          <div class="item">
            <h4>${escapeHtml(mail.subject)}</h4>
            <p><strong>Para:</strong> ${escapeHtml(mail.to)}</p>
            <p class="meta">${formatDate(mail.createdAt)} | ${escapeHtml(mail.status)}</p>
          </div>
        `).join('')
      : '<div class="item">Nenhum e-mail simulado registrado.</div>';
  }

  function setupForms(user) {
    document.getElementById('userForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const type = document.getElementById('userTypeInput').value;
        const selectedCourses = [...document.getElementById('userCoordinatorCoursesInput').selectedOptions].map((option) => option.value);
        SIGACStore.createUser({
          nome: document.getElementById('userNameInput').value,
          email: document.getElementById('userEmailInput').value,
          senha: document.getElementById('userPasswordInput').value,
          tipo: type,
          courseId: document.getElementById('userCourseInput').value,
          courseIds: selectedCourses
        });
        document.getElementById('userForm').reset();
        showMessage('userFormMessage', 'Usuário cadastrado com sucesso.', 'success');
        renderAll();
      } catch (error) {
        showMessage('userFormMessage', error.message, 'error');
      }
    });

    document.getElementById('courseForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        SIGACStore.createCourse({
          sigla: document.getElementById('sigla').value,
          nome: document.getElementById('nomeCurso').value,
          area: document.getElementById('areaCurso').value,
          turno: document.getElementById('turnoCurso').value,
          horasMeta: document.getElementById('horasMetaCurso').value
        });
        document.getElementById('courseForm').reset();
        showMessage('courseFormMessage', 'Curso cadastrado com sucesso.', 'success');
        renderAll();
      } catch (error) {
        showMessage('courseFormMessage', error.message, 'error');
      }
    });

    document.getElementById('studentLinkForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        SIGACStore.assignStudentToCourse(document.getElementById('studentSelect').value, document.getElementById('studentCourseSelect').value);
        showMessage('studentLinkMessage', 'Vínculo do aluno salvo com sucesso.', 'success');
        renderAll();
      } catch (error) {
        showMessage('studentLinkMessage', error.message, 'error');
      }
    });

    document.getElementById('coordinatorLinkForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const selected = [...document.getElementById('coordinatorCoursesSelect').selectedOptions].map((option) => option.value);
        SIGACStore.assignCoordinatorCourses(document.getElementById('coordinatorSelect').value, selected);
        showMessage('coordinatorLinkMessage', 'Vínculos do coordenador atualizados.', 'success');
        renderAll();
      } catch (error) {
        showMessage('coordinatorLinkMessage', error.message, 'error');
      }
    });

    document.getElementById('opportunityForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        SIGACStore.createOpportunity(user.id, {
          titulo: document.getElementById('oppTitle').value,
          descricao: document.getElementById('oppDesc').value,
          horas: document.getElementById('oppHours').value
        });
        document.getElementById('opportunityForm').reset();
        showMessage('opportunityFormMessage', 'Oportunidade lançada com sucesso.', 'success');
        renderAll();
      } catch (error) {
        showMessage('opportunityFormMessage', error.message, 'error');
      }
    });

    document.getElementById('settingsForm').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        SIGACStore.updateSettings({
          horasMetaPadrao: document.getElementById('horasMeta').value,
          emailNotificationsEnabled: document.getElementById('emailToggle').checked
        });
        showMessage('settingsMessage', 'Configurações salvas com sucesso.', 'success');
        renderAll();
      } catch (error) {
        showMessage('settingsMessage', error.message, 'error');
      }
    });

    document.getElementById('resetDemoBtn').addEventListener('click', () => {
      if (!confirm('Deseja resetar os dados de demonstração?')) return;
      SIGACStore.resetDemo();
      SIGACStore.login('einstein@sigac.com', '123456789');
      renderAll();
      showMessage('settingsMessage', 'Base de demonstração restaurada.', 'success');
    });
  }

  function renderAll() {
    populateSharedSelects();
    renderDashboard();
    renderUsers();
    renderCourses();
    renderOpportunities();
    renderSettings();
  }

  function init() {
    const user = SIGACStore.requireRole('superadmin');
    if (!user) {
      window.location.href = 'loginsigac.html';
      return;
    }

    document.getElementById('userName').textContent = user.nome;
    document.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => setActiveSection(button.dataset.section));
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      SIGACStore.logout();
      window.location.href = 'loginsigac.html';
    });

    setupForms(user);
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
