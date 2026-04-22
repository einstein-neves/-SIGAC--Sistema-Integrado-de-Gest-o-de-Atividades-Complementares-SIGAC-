(function () {
  'use strict';

  let chartStatus = null;
  let chartEngajamento = null;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

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
    const statusCtx = document.getElementById('chartStatus').getContext('2d');
    const engagementCtx = document.getElementById('chartEngajamento').getContext('2d');
    if (chartStatus) chartStatus.destroy();
    if (chartEngajamento) chartEngajamento.destroy();

    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Aprovados', 'Rejeitados', 'Em análise'],
        datasets: [{ data: [data.aprovados, data.rejeitados, data.pendentes] }]
      }
    });

    chartEngajamento = new Chart(engagementCtx, {
      type: 'bar',
      data: {
        labels: ['Alunos com envio', 'Alunos sem envio'],
        datasets: [{ label: 'Quantidade', data: [data.alunosComEnvio, data.alunosSemEnvio] }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }

  function renderDashboard(user) {
    const data = SIGACStore.getCoordinatorDashboardData(user.id);
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('coordinatorCoursesInfo').textContent = `Cursos vinculados: ${user.courseIds.map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', ') || 'Nenhum curso'}.`;
    document.getElementById('metricsGrid').innerHTML = `
      <div class="card"><h3>Pendentes</h3><div class="metric-value">${data.pendentes}</div></div>
      <div class="card"><h3>Total de alunos</h3><div class="metric-value">${data.totalAlunos}</div></div>
      <div class="card"><h3>Atividades lançadas</h3><div class="metric-value">${data.totalAtividades}</div></div>
      <div class="card"><h3>Aprovados</h3><div class="metric-value">${data.aprovados}</div></div>
    `;
    renderCharts(data);
    document.getElementById('studentsByCourse').innerHTML = data.students.length
      ? data.students.map((student) => `
          <div class="item">
            <h4>${escapeHtml(student.nome)}</h4>
            <p class="meta">Curso: ${escapeHtml(student.course?.sigla || '-')} | Horas: ${student.progress.total}/${student.progress.target}</p>
            <div class="progress"><span style="width:${student.progress.percent}%"></span></div>
          </div>
        `).join('')
      : '<div class="item">Nenhum aluno vinculado aos seus cursos.</div>';
  }

  function renderActivities(user) {
    const activities = SIGACStore.listActivitiesForCoordinator(user.id);
    document.getElementById('activitiesList').innerHTML = activities.length
      ? activities.map((activity) => `
          <div class="item">
            <h4>${escapeHtml(activity.titulo)}</h4>
            <p>${escapeHtml(activity.descricao)}</p>
            <p class="meta">Curso: ${escapeHtml(SIGACStore.getCourseById(activity.courseId)?.sigla || '-')} | Horas: ${activity.horas} | Prazo: ${activity.prazo || 'Aberto'}</p>
            ${activity.materialArquivo ? `<a class="button secondary" href="${activity.materialArquivo}" download="${escapeHtml(activity.materialNome || 'material.txt')}">Baixar material</a>` : '<span class="small">Sem material anexado.</span>'}
          </div>
        `).join('')
      : '<div class="item">Nenhuma atividade publicada ainda.</div>';
  }

  function renderSubmissions(user) {
    const submissions = SIGACStore.getCoordinatorDashboardData(user.id).submissions;
    const container = document.getElementById('pendingSubmissionsList');
    container.innerHTML = submissions.length
      ? submissions.map((submission) => `
          <div class="item">
            <h4>${escapeHtml(submission.student?.nome || 'Aluno')}</h4>
            <p><strong>Atividade:</strong> ${escapeHtml(submission.activity?.titulo || '-')}</p>
            <p class="meta">Curso: ${escapeHtml(submission.course?.sigla || '-')} | Versão ${submission.latest?.version || 1} | Enviado em ${formatDate(submission.latest?.enviadaEm)}</p>
            <p><strong>Status atual:</strong> <span class="badge ${submission.latest?.status || 'em_analise'}">${escapeHtml((submission.latest?.status || 'em_analise').replace('_', ' '))}</span></p>
            ${submission.latest?.observacao ? `<p><strong>Observação do aluno:</strong> ${escapeHtml(submission.latest.observacao)}</p>` : ''}
            <div class="actions-row">
              <a class="button secondary" href="${submission.latest?.arquivoData || '#'}" download="${escapeHtml(submission.latest?.arquivoNome || 'arquivo.txt')}">Abrir arquivo enviado</a>
            </div>
            ${submission.latest?.status === 'em_analise' ? `
              <form class="evaluation-form" data-submission-id="${submission.id}" style="margin-top:12px;">
                <div class="field"><label>Feedback</label><textarea name="feedback" placeholder="Comentário para o aluno"></textarea></div>
                <div class="actions-row">
                  <button type="button" class="approve-btn success">Aprovar</button>
                  <button type="button" class="reject-btn danger">Rejeitar</button>
                </div>
              </form>
            ` : `<p class="small"><strong>Feedback:</strong> ${escapeHtml(submission.latest?.feedback || 'Sem observações.')}</p>`}
          </div>
        `).join('')
      : '<div class="item">Nenhum envio encontrado.</div>';

    container.querySelectorAll('.evaluation-form').forEach((form) => {
      const feedback = () => form.querySelector('textarea').value;
      form.querySelector('.approve-btn').addEventListener('click', () => {
        try {
          SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'aprovado', feedback());
          renderAll(user);
        } catch (error) {
          alert(error.message);
        }
      });
      form.querySelector('.reject-btn').addEventListener('click', () => {
        try {
          SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderAll(user);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderOpportunities(user) {
    const container = document.getElementById('opportunitiesList');
    const opportunities = SIGACStore.listOpportunities();
    container.innerHTML = opportunities.length
      ? opportunities.map((opportunity) => {
          const enrolled = opportunity.inscritos.includes(user.id);
          return `
            <div class="item">
              <h4>${escapeHtml(opportunity.titulo)}</h4>
              <p>${escapeHtml(opportunity.descricao)}</p>
              <p class="meta">Horas: ${opportunity.horas}h</p>
              <button class="toggle-opp ${enrolled ? 'secondary' : ''}" data-id="${opportunity.id}">${enrolled ? 'Desinscrever' : 'Inscrever-se'}</button>
            </div>
          `;
        }).join('')
      : '<div class="item">Nenhuma oportunidade aberta.</div>';

    container.querySelectorAll('.toggle-opp').forEach((button) => {
      button.addEventListener('click', () => {
        SIGACStore.toggleOpportunity(user.id, button.dataset.id);
        renderAll(user);
      });
    });
  }

  function populateCourseSelects(user) {
    const courses = user.courseIds.map((courseId) => SIGACStore.getCourseById(courseId)).filter(Boolean);
    const options = '<option value="">Selecione um curso...</option>' + courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    document.getElementById('courseId').innerHTML = options;
  }

  function setupActivityForm(user) {
    const form = document.getElementById('activityForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const materialFile = document.getElementById('material').files[0];
      let materialArquivo = '';
      let materialNome = '';
      if (materialFile) {
        materialArquivo = await fileToDataUrl(materialFile);
        materialNome = materialFile.name;
      }

      try {
        SIGACStore.createActivity(user.id, {
          titulo: document.getElementById('titulo').value,
          descricao: document.getElementById('descricao').value,
          courseId: document.getElementById('courseId').value,
          horas: document.getElementById('horas').value,
          prazo: document.getElementById('prazo').value,
          materialNome,
          materialArquivo
        });
        form.reset();
        showMessage('activityMessage', 'Atividade publicada com sucesso.', 'success');
        populateCourseSelects(SIGACStore.getCurrentUser());
        renderAll(SIGACStore.getCurrentUser());
      } catch (error) {
        showMessage('activityMessage', error.message, 'error');
      }
    });
  }

  function renderAll(user) {
    renderDashboard(user);
    renderActivities(user);
    renderSubmissions(user);
    renderOpportunities(user);
  }

  function init() {
    const user = SIGACStore.requireRole('coordenador');
    if (!user) {
      window.location.href = 'loginsigac.html';
      return;
    }

    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = 'Coordenador';
    populateCourseSelects(user);
    setupActivityForm(user);

    document.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => setActiveSection(button.dataset.section));
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      SIGACStore.logout();
      window.location.href = 'loginsigac.html';
    });

    renderAll(user);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
