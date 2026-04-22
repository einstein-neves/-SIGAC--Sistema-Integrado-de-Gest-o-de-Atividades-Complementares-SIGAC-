(function () {
  'use strict';

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderNotifications(user) {
    const container = document.getElementById('notificationsList');
    const notifications = SIGACStore.listNotificationsForUser(user.id);
    document.getElementById('notifCount').style.display = notifications.length ? 'inline-block' : 'none';
    document.getElementById('notifCount').textContent = notifications.length;

    if (!notifications.length) {
      container.innerHTML = '<div class="item">Nenhuma notificação recente.</div>';
      return;
    }

    container.innerHTML = notifications.map((item) => `
      <div class="item">
        <p>${escapeHtml(item.mensagem)}</p>
        <span class="small">${formatDate(item.createdAt)}</span>
      </div>
    `).join('');

    SIGACStore.markNotificationsAsRead(user.id);
  }

  function renderDashboard(user) {
    const course = SIGACStore.getCourseById(user.courseId);
    const progress = SIGACStore.getStudentProgress(user.id);
    const submissions = SIGACStore.listSubmissionsForStudent(user.id);
    const approved = submissions.filter((submission) => submission.currentStatus === 'aprovado').length;
    const rejected = submissions.filter((submission) => submission.currentStatus === 'rejeitado').length;
    const pending = submissions.filter((submission) => submission.currentStatus === 'em_analise').length;

    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = 'Aluno';
    document.getElementById('courseInfo').innerHTML = course
      ? `<strong>${escapeHtml(course.sigla)}</strong> - ${escapeHtml(course.nome)} | Turno: ${escapeHtml(course.turno)}`
      : 'Você ainda não está vinculado a um curso.';

    document.getElementById('metricsGrid').innerHTML = `
      <div class="card"><h3>Horas totais</h3><div class="metric-value">${progress.total}h</div></div>
      <div class="card"><h3>Meta do curso</h3><div class="metric-value">${progress.target}h</div></div>
      <div class="card"><h3>Envios aprovados</h3><div class="metric-value">${approved}</div></div>
      <div class="card"><h3>Envios pendentes</h3><div class="metric-value">${pending}</div></div>
    `;

    document.getElementById('progressBar').style.width = `${progress.percent}%`;
    document.getElementById('progressText').textContent = `${progress.total} de ${progress.target} horas (${progress.percent}%)`;
    document.getElementById('hoursBreakdown').textContent = `Atividades aprovadas: ${progress.approvedHours}h | Oportunidades inscritas: ${progress.opportunityHours}h`;

    document.getElementById('submissionSummary').innerHTML = `
      <ul style="list-style:none; padding:0; margin:0;">
        <li>✅ Aprovados: <strong>${approved}</strong></li>
        <li>❌ Rejeitados: <strong>${rejected}</strong></li>
        <li>⏳ Em análise: <strong>${pending}</strong></li>
      </ul>
    `;
  }

  function renderActivities(user) {
    const container = document.getElementById('activitiesList');
    const activities = SIGACStore.listActivitiesForCourse(user.courseId);

    if (!activities.length) {
      container.innerHTML = '<div class="item">Nenhuma atividade disponível no momento.</div>';
      return;
    }

    container.innerHTML = activities.map((activity) => {
      const submission = SIGACStore.getStudentSubmissionForActivity(user.id, activity.id);
      const latest = submission?.versions?.[submission.versions.length - 1] || null;
      const canSubmit = !latest || latest.status === 'rejeitado';
      const statusBadge = latest ? `<span class="badge ${latest.status}">${latest.status.replace('_', ' ')}</span>` : '<span class="badge">Sem envio</span>';
      const downloadMaterial = activity.materialArquivo
        ? `<a class="button secondary" href="${activity.materialArquivo}" download="${escapeHtml(activity.materialNome || 'material.txt')}">Baixar material de apoio</a>`
        : '<span class="small">Sem material anexado.</span>';

      return `
        <div class="item">
          <h4>${escapeHtml(activity.titulo)}</h4>
          <p>${escapeHtml(activity.descricao)}</p>
          <p class="meta"><strong>Horas:</strong> ${activity.horas} | <strong>Prazo:</strong> ${activity.prazo || 'Aberto'}</p>
          <div class="actions-row" style="margin-bottom:10px;">${downloadMaterial} ${statusBadge}</div>
          ${latest ? `<p class="small"><strong>Último envio:</strong> versão ${latest.version} em ${formatDate(latest.enviadaEm)}${latest.feedback ? ` | Feedback: ${escapeHtml(latest.feedback)}` : ''}</p>` : ''}
          <form class="submission-form" data-activity-id="${activity.id}">
            <div class="field"><label>Observação</label><textarea name="observacao" ${canSubmit ? '' : 'disabled'} placeholder="Alguma observação sobre o arquivo?"></textarea></div>
            <div class="field"><label>Arquivo do aluno</label><input type="file" ${canSubmit ? '' : 'disabled'}></div>
            <button type="submit" ${canSubmit ? '' : 'disabled'}>${latest && latest.status === 'rejeitado' ? 'Enviar nova versão' : 'Enviar comprovante'}</button>
          </form>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.submission-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fileInput = form.querySelector('input[type="file"]');
        const file = fileInput.files[0];
        if (!file) {
          alert('Selecione um arquivo antes de enviar.');
          return;
        }
        try {
          const dataUrl = await fileToDataUrl(file);
          SIGACStore.submitActivityProof(user.id, {
            activityId: form.dataset.activityId,
            arquivoNome: file.name,
            arquivoData: dataUrl,
            observacao: form.querySelector('textarea').value
          });
          alert('Arquivo enviado para análise.');
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
    if (!opportunities.length) {
      container.innerHTML = '<div class="item">Nenhuma oportunidade aberta.</div>';
      return;
    }

    container.innerHTML = opportunities.map((opportunity) => {
      const enrolled = opportunity.inscritos.includes(user.id);
      return `
        <div class="item">
          <h4>${escapeHtml(opportunity.titulo)}</h4>
          <p>${escapeHtml(opportunity.descricao)}</p>
          <p class="meta">Horas complementares: ${opportunity.horas}h</p>
          <button class="opportunity-toggle ${enrolled ? 'secondary' : ''}" data-id="${opportunity.id}">${enrolled ? 'Desinscrever' : 'Inscrever-se'}</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.opportunity-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        SIGACStore.toggleOpportunity(user.id, button.dataset.id);
        renderAll(user);
      });
    });
  }

  function renderAll(user) {
    renderNotifications(user);
    renderDashboard(user);
    renderActivities(user);
    renderOpportunities(user);
  }

  function init() {
    const user = SIGACStore.requireRole('aluno');
    if (!user) {
      window.location.href = 'loginsigac.html';
      return;
    }

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
