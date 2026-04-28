(function () {
  'use strict';

  let activitySearchTerm = '';
  let activityStatusFilter = 'todos';
  let activitySortFilter = 'prazo';
  let selectedSubmissionActivity = null;
  let opportunitySearchTerm = '';
  let opportunityStatusFilter = 'todas';
  let opportunitySortFilter = 'recentes';
  let certificateSearchTerm = '';
  let certificateAdminFilter = 'todos';

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';

  function getDaysFromNow(value) {
    if (!value) return Number.POSITIVE_INFINITY;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function setUserIdentity(user, roleLabel) {
    document.getElementById('userName').textContent = user.nome;
    document.getElementById('userRole').textContent = roleLabel;
    const initial = document.getElementById('userInitial');
    if (initial) {
      const firstLetter = String(user.nome || '?').trim().charAt(0).toUpperCase() || '?';
      initial.textContent = firstLetter;
    }
  }

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  }

  function showSectionLoading(sectionId, text = 'Carregando...') {
    const targetId = {
      dashboard: 'notificationsList',
      atividades: 'activitiesList',
      certificados: 'certificatesList',
      oportunidades: 'opportunitiesList'
    }[sectionId];
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    target.innerHTML = `<div class="item small">${escapeHtml(text)}</div>`;
  }

  async function ensureSectionData(sectionId, options = {}) {
    if (sectionId === 'certificados') return SIGACStore.ensureStudentTabData('certificates', options);
    if (sectionId === 'atividades') return SIGACStore.ensureStudentTabData('activities', options);
    if (sectionId === 'oportunidades') return SIGACStore.ensureStudentTabData('activities', options);
    return null;
  }

  async function openSection(sectionId, options = {}) {
    setActiveSection(sectionId);
    if (sectionId !== 'dashboard') showSectionLoading(sectionId, 'Carregando dados da aba...');
    await ensureSectionData(sectionId, options);
    renderSection(sectionId, SIGACStore.getCurrentUser());
    decorateStudentAccents();
  }

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

  function badgeClass(status) {
    return {
      aprovado: 'aprovado',
      rejeitado: 'rejeitado',
      pendente: 'em_analise',
      em_analise: 'em_analise',
      sem_envio: ''
    }[status] || 'em_analise';
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function applyAccentClass(element, tone = 'orange') {
    if (!element) return;
    element.classList.add('accent-card');
    ['accent-card--orange', 'accent-card--green', 'accent-card--warning', 'accent-card--danger', 'accent-card--info']
      .forEach((className) => element.classList.remove(className));
    const toneClass = {
      orange: 'accent-card--orange',
      green: 'accent-card--green',
      warning: 'accent-card--warning',
      danger: 'accent-card--danger',
      info: 'accent-card--info'
    }[tone] || 'accent-card--orange';
    element.classList.add(toneClass);
  }

  function decorateStudentAccents() {
    document.querySelectorAll('.dashboard-hero, #atividades > .card, .certificate-upload-card, .opportunity-panel').forEach((element) => applyAccentClass(element, 'orange'));
    document.querySelectorAll('#dashboard .dashboard-overview .card, #dashboard .dashboard-shell > .card:not(.dashboard-hero), .certificate-history-card').forEach((element) => applyAccentClass(element, 'info'));
    document.querySelectorAll('#metricsGrid .metric-card').forEach((element) => {
      const tone = element.classList.contains('danger') ? 'danger'
        : element.classList.contains('attention') ? 'warning'
          : 'orange';
      applyAccentClass(element, tone);
    });
  }

  function statusLabel(status) {
    return {
      sem_envio: 'Sem envio',
      em_analise: 'Em an\u00e1lise',
      aprovado: 'Aprovado',
      rejeitado: 'Reprovado'
    }[status] || String(status || 'Sem envio').replaceAll('_', ' ');
  }

  function ocrStatusLabel(status) {
    return {
      nao_processado: 'Aguardando pr\u00e9-an\u00e1lise do OCR',
      analise_manual: 'Pr\u00e9-an\u00e1lise com revis\u00e3o manual',
      aprovado_automatico: 'Pr\u00e9-an\u00e1lise aprovada',
      rejeitado_automatico: 'Pr\u00e9-an\u00e1lise inconclusiva'
    }[String(status || '')] || String(status || 'nao_processado').replaceAll('_', ' ');
  }

  function buildStudentCertificateMessage(certificate) {
    return certificate.humanSummary || certificate.ocrReason || 'Aguardando pr\u00e9-an\u00e1lise do OCR.';
  }

  function getActivitySubmissionState(user, activity) {
    const submission = SIGACStore.getStudentSubmissionForActivity(user.id, activity.id);
    const latest = submission?.versions?.[submission.versions.length - 1] || null;
    const status = latest?.status || submission?.currentStatus || 'sem_envio';
    return {
      submission,
      latest,
      status,
      canSubmit: !latest || latest.status === 'rejeitado'
    };
  }

  function groupNotifications(notifications) {
    const groups = [
      { label: 'Hoje', items: [] },
      { label: 'Nesta semana', items: [] },
      { label: 'Anteriores', items: [] }
    ];

    notifications.forEach((item) => {
      const days = Math.abs(getDaysFromNow(item.createdAt));
      if (days === 0) groups[0].items.push(item);
      else if (days <= 7) groups[1].items.push(item);
      else groups[2].items.push(item);
    });

    return groups.filter((group) => group.items.length);
  }

  function getNotificationTone(message) {
    const text = normalize(message);
    if (text.includes('aprov')) return 'success';
    if (text.includes('rejeit') || text.includes('penden')) return 'warning';
    if (text.includes('analise') || text.includes('avali')) return 'info';
    return 'neutral';
  }

  function getProgressTone(percent) {
    if (percent >= 100) return 'success';
    if (percent >= 60) return 'attention';
    return 'focus';
  }

  function buildUpcomingActions(user, progress, submissions) {
    const activities = SIGACStore.listActivitiesForCourse(user.courseId).map((activity) => ({
      activity,
      ...getActivitySubmissionState(user, activity)
    }));
    const opportunities = SIGACStore.listOpportunities();
    const rejectedItems = activities.filter((item) => item.status === 'rejeitado');
    const openActivities = activities
      .filter((item) => item.status === 'sem_envio')
      .sort((a, b) => String(a.activity.prazo || '9999-12-31').localeCompare(String(b.activity.prazo || '9999-12-31')));
    const enrolledOpportunities = opportunities.filter((item) => item.inscritos.includes(user.id));
    const availableOpportunities = opportunities
      .filter((item) => !item.inscritos.includes(user.id))
      .sort((a, b) => Number(b.horas || 0) - Number(a.horas || 0));
    const pendingReviewCount = submissions.filter((item) => item.currentStatus === 'em_analise').length;
    const remainingHours = Math.max((progress.target || 0) - (progress.total || 0), 0);
    const actions = [];

    if (remainingHours > 0) {
      actions.push({
        tone: getProgressTone(progress.percent || 0),
        title: remainingHours > 20 ? 'Foque nas próximas horas da meta' : 'Você está perto de concluir a meta',
        detail: `${remainingHours}h restantes para atingir ${progress.target || 0}h no curso.`,
        meta: `${progress.total || 0}h concluidas ate agora`,
        cta: 'Ver atividades',
        target: 'atividades'
      });
    } else {
      actions.push({
        tone: 'success',
        title: 'Meta de horas concluida',
        detail: `Você já alcançou ${progress.total || 0}h e cumpriu a exigência do curso.`,
        meta: 'Continue acompanhando novas validacoes',
        cta: 'Ver certificados',
        target: 'certificados'
      });
    }

    if (rejectedItems.length) {
      const nextRejected = rejectedItems[0];
      actions.push({
        tone: 'warning',
        title: 'Reenvie comprovantes reprovados',
        detail: `${rejectedItems.length} envio(s) precisam de nova versao para voltar ao fluxo.`,
        meta: nextRejected?.activity?.titulo || 'Abra a lista de atividades para corrigir',
        cta: 'Corrigir agora',
        target: 'atividades'
      });
    } else if (pendingReviewCount) {
      actions.push({
        tone: 'info',
        title: 'Acompanhe seus envios em análise',
        detail: `${pendingReviewCount} envio(s) aguardando avaliação da coordenação ou administração.`,
        meta: 'Verifique notificações e feedbacks recentes',
        cta: 'Ver certificados',
        target: 'certificados'
      });
    }

    if (openActivities.length) {
      const nextActivity = openActivities[0].activity;
      actions.push({
        tone: 'focus',
        title: 'Aproveite atividades ainda sem envio',
        detail: `${openActivities.length} atividade(s) do curso ainda estão disponíveis para comprovante.`,
        meta: `${nextActivity.titulo} | ${nextActivity.horas || 0}h | Prazo: ${nextActivity.prazo || 'Aberto'}`,
        cta: 'Abrir atividades',
        target: 'atividades'
      });
    }

    if (availableOpportunities.length) {
      const topOpportunity = availableOpportunities[0];
      actions.push({
        tone: 'accent',
        title: 'Explore novas oportunidades',
        detail: `${availableOpportunities.length} oportunidade(s) abertas para aumentar suas horas complementares.`,
        meta: `${topOpportunity.titulo} | ${topOpportunity.horas || 0}h disponíveis`,
        cta: enrolledOpportunities.length ? 'Ver mural' : 'Quero participar',
        target: 'oportunidades'
      });
    }

    return actions.slice(0, 4);
  }

  function renderNotifications() {
    const user = SIGACStore.getCurrentUser();
    const container = document.getElementById('notificationsList');
    const notifications = SIGACStore.listNotificationsForUser(user.id);
    const count = document.getElementById('notifCount');
    const badge = document.getElementById('notificationsBadge');

    count.style.display = notifications.length ? 'inline-block' : 'none';
    count.textContent = notifications.length;
    if (badge) badge.textContent = `${notifications.length} ${notifications.length === 1 ? 'nova' : 'novas'}`;

    if (!notifications.length) {
      container.innerHTML = `
        <div class="dashboard-empty-state">
          <strong>Nenhuma notificação recente</strong>
          <p class="small">Quando houver atualizações sobre certificados, atividades ou oportunidades, elas aparecerão aqui.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = groupNotifications(notifications).map((group) => `
      <section class="notification-group">
        <div class="notification-group-head">
          <h3>${group.label}</h3>
          <span>${group.items.length} ${group.items.length === 1 ? 'aviso' : 'avisos'}</span>
        </div>
        <div class="notification-group-list">
          ${group.items.map((item) => `
            <article class="notification-item tone-${getNotificationTone(item.mensagem)}">
              <span class="notification-marker" aria-hidden="true"></span>
              <div class="notification-copy">
                <p>${escapeHtml(item.mensagem)}</p>
                <span class="small">${formatDate(item.createdAt)}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `).join('');
  }

  function renderDashboard(user) {
    const course = SIGACStore.getCourseById(user.courseId);
    const activeCourseSelect = document.getElementById('activeCourseSelect');
    const courses = SIGACStore.listStudentCourses();
    const progress = SIGACStore.getStudentProgress(user.id);
    const submissions = SIGACStore.listSubmissionsForStudent(user.id);
    const approved = submissions.filter((submission) => submission.currentStatus === 'aprovado').length;
    const inReview = submissions.filter((submission) => submission.currentStatus === 'em_analise').length;
    const pending = SIGACStore.listActivitiesForCourse(user.courseId)
      .filter((activity) => getActivitySubmissionState(user, activity).status === 'sem_envio').length;
    const remainingHours = Math.max((progress.target || 0) - (progress.total || 0), 0);
    const actions = buildUpcomingActions(user, progress, submissions);
    const progressTone = getProgressTone(progress.percent || 0);
    const ring = document.querySelector('.dashboard-progress-ring');

    activeCourseSelect.innerHTML = courses.length
      ? courses.map((item) => `<option value="${item.id}" ${item.id === user.courseId ? 'selected' : ''}>${escapeHtml(item.sigla)} - ${escapeHtml(item.nome)}</option>`).join('')
      : '<option value="">Sem curso vinculado</option>';
    activeCourseSelect.disabled = courses.length <= 1;

    setUserIdentity(user, 'Aluno');
    document.getElementById('courseInfo').innerHTML = course
      ? `<strong>${escapeHtml(course.sigla)}</strong> - ${escapeHtml(course.nome)} | Turno: ${escapeHtml(course.turno)}`
      : 'Você ainda não está vinculado a um curso.';

    document.getElementById('dashboardLead').textContent = remainingHours
      ? `Você já concluiu ${progress.total || 0}h e ainda faltam ${remainingHours}h para atingir a meta do curso.`
      : `Meta alcançada com ${progress.total || 0}h registradas. Agora o foco é acompanhar validações e novas oportunidades.`;

    document.getElementById('heroHighlights').innerHTML = `
      <div class="dashboard-kpi-card accent-card">
        <span>Horas totais</span>
        <strong>${progress.total || 0}h</strong>
      </div>
      <div class="dashboard-kpi-card accent-card accent-card--info">
        <span>Meta do curso</span>
        <strong>${progress.target || 0}h</strong>
      </div>
      <div class="dashboard-kpi-card accent-card accent-card--warning">
        <span>Restantes</span>
        <strong>${remainingHours}h</strong>
      </div>
    `;

    document.getElementById('metricsGrid').innerHTML = `
      <div class="card metric-card ${progressTone === 'success' ? '' : progressTone}"><h3>Horas totais</h3><div class="metric-value">${progress.total || 0}h</div><p class="small">Registradas no seu histórico</p></div>
      <div class="card metric-card"><h3>Meta do curso</h3><div class="metric-value">${progress.target || 0}h</div><p class="small">Carga complementar exigida</p></div>
      <div class="card metric-card ${remainingHours ? 'attention' : ''}"><h3>Horas restantes</h3><div class="metric-value">${remainingHours}h</div><p class="small">${remainingHours ? 'Para concluir a meta' : 'Meta finalizada'}</p></div>
      <div class="card metric-card"><h3>Envios aprovados</h3><div class="metric-value">${approved}</div><p class="small">Itens validados</p></div>
      <div class="card metric-card attention"><h3>Em análise</h3><div class="metric-value">${inReview}</div><p class="small">Aguardando avaliação</p></div>
      <div class="card metric-card ${pending ? 'danger' : ''}"><h3>Envios pendentes</h3><div class="metric-value">${pending}</div><p class="small">Atividades sem comprovante</p></div>
    `;

    document.getElementById('progressBar').style.width = `${progress.percent}%`;
    document.getElementById('progressPercent').textContent = `${progress.percent || 0}%`;
    document.getElementById('progressText').textContent = `${progress.total} de ${progress.target} horas (${progress.percent}%)`;
    document.getElementById('progressBadge').textContent = remainingHours ? `${remainingHours}h restantes` : 'Meta concluída';
    document.getElementById('hoursBreakdown').innerHTML = `
      <span class="summary-chip">Atividades aprovadas <strong>${progress.approvedHours}h</strong></span>
      <span class="summary-chip">Oportunidades inscritas <strong>${progress.opportunityHours}h</strong></span>
      <span class="summary-chip">Certificados aprovados <strong>${progress.certificateHours}h</strong></span>
    `;
    document.getElementById('submissionSummary').innerHTML = `
      <div class="summary-list">
        <div class="summary-stat approved accent-card accent-card--green"><span>Aprovados</span><strong>${approved}</strong></div>
        <div class="summary-stat pending accent-card accent-card--warning"><span>Em análise</span><strong>${inReview}</strong></div>
        <div class="summary-stat neutral accent-card"><span>Pendentes</span><strong>${pending}</strong></div>
      </div>
      <p class="summary-caption">Os envios pendentes representam atividades do curso que ainda não receberam comprovante.</p>
    `;

    if (ring) {
      ring.style.setProperty('--progress', `${Math.max(0, Math.min(progress.percent || 0, 100))}%`);
      ring.style.setProperty('--progress-color', remainingHours ? 'var(--primary)' : 'var(--success)');
    }

    document.getElementById('actionsCount').textContent = `${actions.length} ${actions.length === 1 ? 'item' : 'itens'}`;
    document.getElementById('upcomingActions').innerHTML = actions.length
      ? actions.map((action) => `
          <article class="dashboard-action-card tone-${action.tone} accent-card ${action.tone === 'success' ? 'accent-card--green' : action.tone === 'info' ? 'accent-card--info' : action.tone === 'warning' ? 'accent-card--warning' : action.tone === 'accent' ? 'accent-card--info' : action.tone === 'focus' || action.tone === 'attention' ? 'accent-card' : 'accent-card'}">
            <div class="dashboard-action-copy">
              <h3>${escapeHtml(action.title)}</h3>
              <p>${escapeHtml(action.detail)}</p>
              <span class="small">${escapeHtml(action.meta)}</span>
            </div>
            <button type="button" class="secondary dashboard-action-btn" data-dashboard-jump="${escapeHtml(action.target)}">${escapeHtml(action.cta)}</button>
          </article>
        `).join('')
      : `
        <div class="dashboard-empty-state">
          <strong>Nenhuma ação urgente</strong>
          <p class="small">Seu painel está em dia. Use o mural para descobrir novas oportunidades.</p>
        </div>
      `;

    document.querySelectorAll('[data-dashboard-jump]').forEach((button) => {
      button.addEventListener('click', () => setActiveSection(button.dataset.dashboardJump));
    });
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
      const statusBadge = latest
        ? `<span class="badge ${latest.status}">${latest.status.replace('_', ' ')}</span>`
        : '<span class="badge">Sem envio</span>';
      const downloadMaterial = activity.materialNome
        ? `<button type="button" class="button secondary activity-material-btn" data-activity-id="${activity.id}">Baixar material de apoio</button>`
        : '<span class="small">Sem material anexado.</span>';

      return `
        <div class="item">
          <h4>${escapeHtml(activity.titulo)}</h4>
          <p>${escapeHtml(activity.descricao)}</p>
          <p class="meta"><strong>Horas:</strong> ${activity.horas} | <strong>Prazo:</strong> ${activity.prazo || 'Aberto'}</p>
          <div class="actions-row" style="margin-bottom:10px;">${downloadMaterial} ${statusBadge}</div>
          ${latest ? `<p class="small"><strong>Último envio:</strong> versão ${latest.version} em ${formatDate(latest.enviadaEm)}${latest.feedback ? ` | Feedback: ${escapeHtml(latest.feedback)}` : ''}</p>` : ''}
          <form class="submission-form" data-activity-id="${activity.id}">
            <div class="field"><label>Categoria</label><select name="categoria" ${canSubmit ? '' : 'disabled'} required><option value="">Selecione...</option><option>Ensino</option><option>Pesquisa</option><option>Extensão</option><option>Eventos</option><option>Cursos livres</option><option>Monitoria</option><option>Projetos</option></select></div>
            <div class="field"><label>Carga horária declarada</label><input name="horasDeclaradas" type="number" min="1" value="${activity.horas || ''}" ${canSubmit ? '' : 'disabled'} required></div>
            <div class="field"><label>Descrição da atividade realizada</label><textarea name="descricao" ${canSubmit ? '' : 'disabled'} required placeholder="Descreva a atividade complementar realizada."></textarea></div>
            <div class="field"><label>Observação</label><textarea name="observacao" ${canSubmit ? '' : 'disabled'} placeholder="Alguma observação sobre o arquivo?"></textarea></div>
            <div class="field"><label>Arquivo do aluno</label><input type="file" ${canSubmit ? '' : 'disabled'}></div>
            <button type="submit" ${canSubmit ? '' : 'disabled'}>${latest && latest.status === 'rejeitado' ? 'Enviar nova versão' : 'Enviar comprovante'}</button>
          </form>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.activity-material-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openActivityMaterial(button.dataset.activityId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

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
          await SIGACStore.submitActivityProof(user.id, {
            activityId: form.dataset.activityId,
            categoria: form.querySelector('[name="categoria"]').value,
            horasDeclaradas: form.querySelector('[name="horasDeclaradas"]').value,
            descricao: form.querySelector('[name="descricao"]').value,
            arquivoNome: file.name,
            arquivoData: dataUrl,
            observacao: form.querySelector('[name="observacao"]').value
          });
          renderAll(SIGACStore.getCurrentUser());
          alert('Arquivo enviado para análise.');
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function getVisibleActivityItems(user) {
    const activities = SIGACStore.listActivitiesForCourse(user.courseId);
    const items = activities.map((activity) => ({
      activity,
      ...getActivitySubmissionState(user, activity)
    }));

    return items.filter((item) => {
      const haystack = normalize(`${item.activity.titulo} ${item.activity.descricao} ${item.status}`);
      const matchesSearch = !activitySearchTerm || haystack.includes(normalize(activitySearchTerm));
      const matchesStatus = activityStatusFilter === 'todos' || item.status === activityStatusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (activitySortFilter === 'horas') return Number(b.activity.horas || 0) - Number(a.activity.horas || 0);
      if (activitySortFilter === 'titulo') return String(a.activity.titulo || '').localeCompare(String(b.activity.titulo || ''), 'pt-BR');
      return String(a.activity.prazo || '9999-12-31').localeCompare(String(b.activity.prazo || '9999-12-31'));
    });
  }

  function shortenText(value, maxLength) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  function getDeadlineInfo(value) {
    if (!value) {
      return {
        tone: 'open',
        label: 'Prazo aberto',
        meta: 'Sem data limite informada'
      };
    }
    const days = getDaysFromNow(value);
    if (days < 0) {
      return {
        tone: 'late',
        label: 'Prazo vencido',
        meta: `Encerrado ha ${Math.abs(days)} dia(s)`
      };
    }
    if (days <= 3) {
      return {
        tone: 'soon',
        label: 'Prazo próximo',
        meta: days === 0 ? 'Encerra hoje' : `Encerra em ${days} dia(s)`
      };
    }
    return {
      tone: 'scheduled',
      label: 'Dentro do prazo',
      meta: `Faltam ${days} dia(s)`
    };
  }

  function renderActivitySummary(user) {
    const progress = SIGACStore.getStudentProgress(user.id);
    const activities = SIGACStore.listActivitiesForCourse(user.courseId);
    const items = activities.map((activity) => ({
      activity,
      ...getActivitySubmissionState(user, activity)
    }));
    const pendingHours = items
      .filter((item) => item.status === 'em_analise')
      .reduce((sum, item) => sum + Number(item.latest?.horasDeclaradas || item.activity.horas || 0), 0);

    document.getElementById('activitySummaryGrid').innerHTML = `
      <div class="card metric-card"><h3>Horas aprovadas</h3><div class="metric-value">${progress.approvedHours || 0}h</div><p class="small">Validadas no curso</p></div>
      <div class="card metric-card"><h3>Em análise</h3><div class="metric-value">${pendingHours}h</div><p class="small">Aguardando avaliação</p></div>
      <div class="card metric-card"><h3>Enviadas</h3><div class="metric-value">${items.filter((item) => item.status !== 'sem_envio').length}</div><p class="small">Com comprovante</p></div>
      <div class="card metric-card"><h3>Disponíveis</h3><div class="metric-value">${items.filter((item) => item.canSubmit).length}</div><p class="small">Abertas para envio</p></div>
    `;
  }

  function renderActivitiesCompact(user) {
    const container = document.getElementById('activitiesList');
    const allActivities = SIGACStore.listActivitiesForCourse(user.courseId);
    renderActivitySummary(user);

    if (!allActivities.length) {
      container.innerHTML = '<div class="item">Nenhuma atividade disponível no momento.</div>';
      return;
    }

    const items = getVisibleActivityItems(user);
    const result = document.getElementById('activityFilterResult');
    if (result) {
      const activeLabel = document.querySelector(`[data-activity-status="${activityStatusFilter}"]`)?.textContent || 'Todas';
      result.textContent = `${items.length} de ${allActivities.length} atividades exibidas | Status: ${activeLabel}${activitySearchTerm ? ` | Busca: "${activitySearchTerm}"` : ''}`;
    }
    if (!items.length) {
      container.innerHTML = `
        <div class="activity-empty-state">
          <div class="activity-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhuma atividade encontrada</h3>
          <p>Ajuste os filtros ou limpe a busca para visualizar outras atividades do seu curso.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(({ activity, latest, status, canSubmit }) => {
      const statusBadge = `<span class="badge ${badgeClass(status)}">${escapeHtml(statusLabel(status))}</span>`;
      const deadline = getDeadlineInfo(activity.prazo);
      const material = activity.materialNome
        ? `<button type="button" class="button secondary activity-material-btn" data-activity-id="${activity.id}">Baixar material</button>`
        : '<span class="small activity-material-empty">Sem material de apoio</span>';
      return `
        <div class="item activity-card accent-card ${status === 'aprovado' ? 'accent-card--green' : status === 'em_analise' ? 'accent-card--warning' : status === 'rejeitado' ? 'accent-card--danger' : 'accent-card'}" data-activity-id="${activity.id}">
          <div class="activity-card-top">
            <div class="activity-card-heading">
              <h4>${escapeHtml(activity.titulo)}</h4>
              <p>${escapeHtml(shortenText(activity.descricao, 160))}</p>
            </div>
            <div class="activity-status">${statusBadge}</div>
          </div>
          <div class="activity-card-main">
            <div class="activity-meta-grid">
              <div class="activity-meta-card accent-card">
                <span>Horas</span>
                <strong>${activity.horas || 0}h</strong>
              </div>
              <div class="activity-meta-card accent-card accent-card--info">
                <span>Prazo</span>
                <strong>${escapeHtml(activity.prazo || 'Aberto')}</strong>
              </div>
              <div class="activity-meta-card deadline-${deadline.tone} accent-card ${deadline.tone === 'late' ? 'accent-card--danger' : deadline.tone === 'soon' ? 'accent-card--warning' : 'accent-card--green'}">
                <span>${deadline.label}</span>
                <strong>${deadline.meta}</strong>
              </div>
            </div>
            <div class="activity-support-row">
              <div class="activity-support">
                <span class="small">Material de apoio</span>
                <div class="actions-row">${material}</div>
              </div>
              ${latest
                ? `<p class="small activity-latest"><strong>Último envio:</strong> versão ${latest.version} em ${formatDate(latest.enviadaEm)}${latest.feedback ? ` | Feedback: ${escapeHtml(latest.feedback)}` : ''}</p>`
                : '<p class="small activity-latest">Nenhum comprovante enviado ainda.</p>'}
            </div>
          </div>
          <div class="actions-row activity-actions">
            <button type="button" class="secondary details-activity-btn">Ver detalhes</button>
            ${canSubmit
              ? `<button type="button" class="submit-activity-btn">${latest?.status === 'rejeitado' ? 'Enviar nova versão' : 'Enviar comprovante'}</button>`
              : '<button type="button" class="secondary" disabled>Envio bloqueado</button>'}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.activity-material-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openActivityMaterial(button.dataset.activityId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.details-activity-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const activityId = button.closest('[data-activity-id]')?.dataset.activityId;
        const item = items.find((entry) => entry.activity.id === activityId);
        if (!item) return;
        alert(`${item.activity.titulo}\n\n${item.activity.descricao}\n\nHoras: ${item.activity.horas || 0}\nPrazo: ${item.activity.prazo || 'Aberto'}\nStatus: ${statusLabel(item.status)}${item.latest?.feedback ? `\nFeedback: ${item.latest.feedback}` : ''}`);
      });
    });

    container.querySelectorAll('.submit-activity-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const activityId = button.closest('[data-activity-id]')?.dataset.activityId;
        const item = items.find((entry) => entry.activity.id === activityId);
        if (item) openSubmissionModal(item.activity);
      });
    });
  }

  function openSubmissionModal(activity) {
    selectedSubmissionActivity = activity;
    const modal = document.getElementById('submissionModal');
    const form = document.getElementById('submissionModalForm');
    form.reset();
    form.elements.activityId.value = activity.id;
    form.elements.horasDeclaradas.value = activity.horas || '';
    document.getElementById('submissionModalTitle').textContent = 'Enviar comprovante';
    document.getElementById('submissionModalMeta').textContent = `${activity.titulo} | ${activity.horas || 0}h | Prazo: ${activity.prazo || 'Aberto'}`;
    modal.classList.remove('hidden');
  }

  function closeSubmissionModal() {
    selectedSubmissionActivity = null;
    document.getElementById('submissionModal').classList.add('hidden');
  }

  function setupActivityControls(user) {
    const refreshActivityFilters = () => {
      document.querySelectorAll('[data-activity-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.activityStatus === activityStatusFilter);
      });
      renderActivitiesCompact(SIGACStore.getCurrentUser());
    };

    document.getElementById('activitySearchInput')?.addEventListener('input', (event) => {
      activitySearchTerm = event.target.value;
      refreshActivityFilters();
    });
    document.querySelectorAll('[data-activity-status]').forEach((button) => {
      button.addEventListener('click', () => {
        activityStatusFilter = button.dataset.activityStatus || 'todos';
        refreshActivityFilters();
      });
    });
    document.getElementById('activitySortFilter')?.addEventListener('change', (event) => {
      activitySortFilter = event.target.value;
      refreshActivityFilters();
    });
    document.getElementById('activityClearFilters')?.addEventListener('click', () => {
      activitySearchTerm = '';
      activityStatusFilter = 'todos';
      activitySortFilter = 'prazo';
      const search = document.getElementById('activitySearchInput');
      const sort = document.getElementById('activitySortFilter');
      if (search) search.value = '';
      if (sort) {
        sort.value = 'prazo';
        sort.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        refreshActivityFilters();
      }
      if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();
    });
    document.getElementById('closeSubmissionModal')?.addEventListener('click', closeSubmissionModal);
    document.getElementById('cancelSubmissionModal')?.addEventListener('click', closeSubmissionModal);
    document.getElementById('submissionModal')?.addEventListener('click', (event) => {
      if (event.target.id === 'submissionModal') closeSubmissionModal();
    });
    document.getElementById('submissionModalForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.elements.arquivo.files[0];
      if (!file || !selectedSubmissionActivity) {
        alert('Selecione um arquivo antes de enviar.');
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        await SIGACStore.submitActivityProof(user.id, {
          activityId: form.elements.activityId.value,
          categoria: form.elements.categoria.value,
          horasDeclaradas: form.elements.horasDeclaradas.value,
          descricao: form.elements.descricao.value,
          arquivoNome: file.name,
          arquivoData: dataUrl,
          observacao: form.elements.observacao.value
        });
        closeSubmissionModal();
        renderAll(SIGACStore.getCurrentUser());
        alert('Arquivo enviado para analise.');
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function renderCertificates(user) {
    const list = SIGACStore.listCertificatesForUser(user.id);
    document.getElementById('certificatesList').innerHTML = list.length
      ? list.map((certificate) => `
          <div class="item">
            <h4>${escapeHtml(certificate.fileName)}</h4>
            <p class="meta">Enviado em ${formatDate(certificate.createdAt)} | Horas declaradas: ${certificate.declaredHours || 0}h</p>
            <p><strong>OCR:</strong> <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(ocrStatusLabel(certificate.ocrStatus))}</span></p>
            <p><strong>Admin:</strong> <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(certificate.adminStatus.replaceAll('_', ' '))}</span></p>
            <p class="small">${escapeHtml(buildStudentCertificateMessage(certificate))}</p>
            ${certificate.adminFeedback ? `<p class="small"><strong>Feedback:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
            <div class="actions-row"><button type="button" class="secondary open-cert-btn" data-certificate-id="${certificate.id}">Abrir certificado</button></div>
          </div>
        `).join('')
      : '<div class="item">Você ainda não enviou certificados para o administrador.</div>';
    document.querySelectorAll('.open-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCertificateFile(button.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupCertificateForm(user) {
    const form = document.getElementById('certificateForm');
    const fileInput = document.getElementById('certificateFile');
    const fileName = document.getElementById('certificateFileName');

    fileInput?.addEventListener('change', () => {
      const selectedFile = fileInput.files?.[0];
      if (fileName) {
        fileName.textContent = selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado';
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = document.getElementById('certificateFile').files[0];

      if (!file) {
        showMessage('certificateMessage', 'Selecione um arquivo antes de enviar.', 'error');
        return;
      }

      try {
        const fileData = await fileToDataUrl(file);
        await SIGACStore.submitCertificate(user.id, {
          fileName: file.name,
          fileData,
          observation: document.getElementById('certificateObservation').value,
          declaredHours: document.getElementById('certificateHours').value
        });
        form.reset();
        if (fileName) fileName.textContent = 'Nenhum arquivo selecionado';
        showMessage('certificateMessage', 'Certificado enviado ao administrador com sucesso.', 'success');
        renderAll(SIGACStore.getCurrentUser());
      } catch (error) {
        showMessage('certificateMessage', error.message, 'error');
      }
    });
  }

  function renderCertificates(user) {
    const list = SIGACStore.listCertificatesForUser(user.id);
    const summary = {
      total: list.length,
      approved: list.filter((certificate) => certificate.adminStatus === 'aprovado').length,
      pending: list.filter((certificate) => certificate.adminStatus === 'pendente').length,
      rejected: list.filter((certificate) => certificate.adminStatus === 'rejeitado').length,
      declaredHours: list.reduce((sum, certificate) => sum + Number(certificate.declaredHours || 0), 0)
    };
    const visible = list.filter((certificate) => {
      const text = normalize(`${certificate.fileName} ${certificate.observation || ''} ${certificate.adminFeedback || ''}`);
      const matchesSearch = !certificateSearchTerm || text.includes(normalize(certificateSearchTerm));
      const matchesAdmin = certificateAdminFilter === 'todos' || certificate.adminStatus === certificateAdminFilter;
      return matchesSearch && matchesAdmin;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    document.getElementById('certificateSummaryGrid').innerHTML = `
      <div class="certificate-summary-card emphasis accent-card">
        <span>Total enviado</span>
        <strong>${summary.total}</strong>
        <small>${summary.declaredHours}h declaradas</small>
      </div>
      <div class="certificate-summary-card approved accent-card accent-card--green">
        <span>Aprovados pelo admin</span>
        <strong>${summary.approved}</strong>
        <small>Status principal da fila</small>
      </div>
      <div class="certificate-summary-card pending accent-card accent-card--warning">
        <span>Pendentes</span>
        <strong>${summary.pending}</strong>
        <small>Aguardando avaliação</small>
      </div>
      <div class="certificate-summary-card rejected accent-card accent-card--danger">
        <span>Rejeitados</span>
        <strong>${summary.rejected}</strong>
        <small>Precisam de revisão</small>
      </div>
    `;

    document.getElementById('certificateFilterResult').textContent = `${visible.length} de ${list.length} certificados exibidos`;

    document.getElementById('certificatesList').innerHTML = visible.length
      ? visible.map((certificate) => {
          const adminLabel = String(certificate.adminStatus || 'pendente').replaceAll('_', ' ');
          const shortMessage = certificate.adminFeedback || 'Seu certificado está em acompanhamento pela administração.';
          return `
            <article class="certificate-history-item item accent-card ${certificate.adminStatus === 'aprovado' ? 'accent-card--green' : certificate.adminStatus === 'rejeitado' ? 'accent-card--danger' : 'accent-card--warning'}">
              <div class="certificate-history-top">
                <div class="certificate-history-title">
                  <h4>${escapeHtml(certificate.fileName)}</h4>
                  <p class="meta">Enviado em ${formatDate(certificate.createdAt)}</p>
                </div>
                <div class="certificate-primary-status admin-${badgeClass(certificate.adminStatus)}">
                  <span>Status do administrador</span>
                  <strong>${escapeHtml(adminLabel)}</strong>
                </div>
              </div>
              <div class="certificate-history-meta">
                <div class="certificate-meta-card accent-card accent-card--info">
                  <span>Horas declaradas</span>
                  <strong>${Number(certificate.declaredHours || 0)}h</strong>
                </div>
                <div class="certificate-meta-card accent-card ${certificate.adminStatus === 'aprovado' ? 'accent-card--green' : certificate.adminStatus === 'rejeitado' ? 'accent-card--danger' : 'accent-card--warning'}">
                  <span>Situação</span>
                  <strong>${escapeHtml(adminLabel)}</strong>
                </div>
              </div>
              <p class="certificate-message">${escapeHtml(shortenText(shortMessage, 180))}</p>
              <div class="certificate-history-actions">
                <button type="button" class="secondary open-cert-btn" data-certificate-id="${certificate.id}">Abrir certificado</button>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="certificate-empty-state">
          <div class="certificate-empty-icon" aria-hidden="true">+</div>
          <h3>Nenhum certificado encontrado</h3>
          <p>Revise os filtros ou envie um novo certificado para acompanhar a análise nesta área.</p>
        </div>
      `;

    document.querySelectorAll('.open-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCertificateFile(button.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupCertificateControls() {
    const refresh = () => renderCertificates(SIGACStore.getCurrentUser());
    document.getElementById('certificateSearchInput')?.addEventListener('input', (event) => {
      certificateSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('certificateAdminFilter')?.addEventListener('change', (event) => {
      certificateAdminFilter = event.target.value;
      refresh();
    });
  }

  function renderOpportunities(user) {
    const container = document.getElementById('opportunitiesList');
    const opportunities = SIGACStore.listOpportunities();
    const enrolled = opportunities.filter((opportunity) => opportunity.inscritos.includes(user.id));
    const visible = getVisibleOpportunities(user, opportunities);

    document.getElementById('opportunitySummaryGrid').innerHTML = `
      <div class="opportunity-summary-card accent-card"><span>Disponíveis</span><strong>${opportunities.length}</strong></div>
      <div class="opportunity-summary-card accent-card accent-card--green"><span>Inscritas</span><strong>${enrolled.length}</strong></div>
      <div class="opportunity-summary-card accent-card accent-card--info"><span>Horas potenciais</span><strong>${opportunities.reduce((sum, item) => sum + Number(item.horas || 0), 0)}h</strong></div>
    `;

    if (!opportunities.length) {
      document.getElementById('opportunityFilterResult').textContent = '';
      container.innerHTML = renderOpportunityEmptyState(
        'Nenhuma oportunidade disponível no momento.',
        'Volte mais tarde para conferir novas atividades complementares.'
      );
      return;
    }

    document.getElementById('opportunityFilterResult').textContent = `${visible.length} de ${opportunities.length} oportunidades exibidas`;
    if (!visible.length) {
      container.innerHTML = renderOpportunityEmptyState('Nenhuma oportunidade encontrada com os filtros atuais.', '');
      return;
    }

    container.innerHTML = `<div class="opportunity-grid">${visible.map((opportunity) => renderOpportunityCard(opportunity, user)).join('')}</div>`;

    container.querySelectorAll('.opportunity-toggle').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.toggleOpportunity(user.id, button.dataset.id);
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function getVisibleOpportunities(user, opportunities) {
    return opportunities.filter((opportunity) => {
      const isEnrolled = opportunity.inscritos.includes(user.id);
      const text = normalize(`${opportunity.titulo} ${opportunity.descricao}`);
      const matchesSearch = !opportunitySearchTerm || text.includes(normalize(opportunitySearchTerm));
      const matchesStatus = opportunityStatusFilter === 'todas'
        || (opportunityStatusFilter === 'inscritas' && isEnrolled)
        || (opportunityStatusFilter === 'disponiveis' && !isEnrolled);
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (opportunitySortFilter === 'maior_horas') return Number(b.horas || 0) - Number(a.horas || 0);
      if (opportunitySortFilter === 'menor_horas') return Number(a.horas || 0) - Number(b.horas || 0);
      return new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0);
    });
  }

  function renderOpportunityCard(opportunity, user) {
    const enrolled = opportunity.inscritos.includes(user.id);
    const status = enrolled ? 'Inscrito' : 'Disponível';
    const dateText = opportunity.criadoEm ? `<span>Publicado em ${formatDate(opportunity.criadoEm)}</span>` : '';
    return `
      <article class="opportunity-card accent-card ${enrolled ? 'enrolled accent-card--green' : 'accent-card'}">
        <div class="opportunity-card-head">
          <span class="opportunity-hours">${Number(opportunity.horas || 0)}h complementares</span>
          <span class="badge ${enrolled ? 'aprovado' : ''}">${status}</span>
        </div>
        <h3>${escapeHtml(opportunity.titulo)}</h3>
        <p>${escapeHtml(opportunity.descricao)}</p>
        <div class="opportunity-meta">${dateText}</div>
        <div class="opportunity-card-actions">
          <button class="opportunity-toggle ${enrolled ? 'opportunity-unenroll' : ''}" data-id="${opportunity.id}">
            ${enrolled ? 'Desinscrever' : 'Inscrever-se'}
          </button>
        </div>
      </article>
    `;
  }

  function renderOpportunityEmptyState(title, subtitle) {
    return `
      <div class="opportunity-empty">
        <div class="opportunity-empty-icon" aria-hidden="true">+</div>
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
    `;
  }

  function setupOpportunityControls() {
    const refresh = () => renderOpportunities(SIGACStore.getCurrentUser());
    document.getElementById('opportunitySearchInput')?.addEventListener('input', (event) => {
      opportunitySearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('opportunityStatusFilter')?.addEventListener('change', (event) => {
      opportunityStatusFilter = event.target.value;
      refresh();
    });
    document.getElementById('opportunitySortFilter')?.addEventListener('change', (event) => {
      opportunitySortFilter = event.target.value;
      refresh();
    });
  }

  function renderAll(user) {
    renderNotifications();
    renderDashboard(user);
    renderActivitiesCompact(user);
    renderCertificates(user);
    renderOpportunities(user);
    decorateStudentAccents();
  }

  function renderSection(sectionId, user) {
    if (sectionId === 'dashboard') {
      renderNotifications();
      renderDashboard(user);
      return;
    }
    if (sectionId === 'atividades') return renderActivitiesCompact(user);
    if (sectionId === 'certificados') return renderCertificates(user);
    if (sectionId === 'oportunidades') return renderOpportunities(user);
  }

  async function init() {
    try {
      const user = await SIGACStore.bootstrap('aluno');
      document.querySelectorAll('[data-section]').forEach((button) => {
        button.addEventListener('click', async () => {
          await openSection(button.dataset.section);
        });
      });
      document.querySelectorAll('[data-section-jump]').forEach((button) => {
        button.addEventListener('click', async () => {
          await openSection(button.dataset.sectionJump);
        });
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        SIGACStore.logout();
        window.location.href = 'loginsigac.html';
      });
      document.getElementById('activeCourseSelect').addEventListener('change', async (event) => {
        if (!event.target.value) return;
        try {
          await SIGACStore.setActiveStudentCourse(event.target.value);
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
      setupCertificateForm(user);
      setupCertificateControls();
      setupActivityControls(user);
      setupOpportunityControls();
      renderSection('dashboard', user);
      decorateStudentAccents();
      SIGACStore.markNotificationsAsRead().catch(() => {});
    } catch (_) {
      window.location.href = 'loginsigac.html';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
