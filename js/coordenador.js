(function () {
  'use strict';

  let chartStatus = null;
  let chartEngajamento = null;
  let coordinatorStudentSearchTerm = '';
  let coordinatorStudentCourseFilter = 'todos';
  let submissionStudentSearchTerm = '';
  let submissionCourseFilter = 'todos';
  let submissionActivityFilter = 'todos';
  let submissionStatusFilter = 'todos';
  let coordinatorActivitySearchTerm = '';
  let coordinatorActivityCourseFilter = 'todos';
  let coordinatorActivityStatusFilter = 'todos';
  let coordinatorOpportunitySearchTerm = '';
  let coordinatorOpportunityStatusFilter = 'todos';
  let certificateStudentSearchTerm = '';
  let certificateStatusFilter = 'todos';
  let certificateCourseFilter = 'todos';
  const PERF_LOGS_ENABLED = true;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem data';

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }

  function logPerf(label, startedAt) {
    if (!PERF_LOGS_ENABLED) return;
    const duration = Math.round(performance.now() - startedAt);
    console.log(`[SIGAC PERF] ${label}: ${duration}ms`);
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
      aprovado_automatico: 'aprovado',
      rejeitado_automatico: 'rejeitado',
      analise_manual: 'em_analise',
      nao_processado: 'em_analise'
    }[status] || 'em_analise';
  }

  function statusLabel(status) {
    const labels = {
      nao_processado: 'Aguardando pr\u00e9-an\u00e1lise do OCR',
      analise_manual: 'Pr\u00e9-an\u00e1lise com revis\u00e3o manual',
      aprovado_automatico: 'Pr\u00e9-an\u00e1lise aprovada',
      rejeitado_automatico: 'Pr\u00e9-an\u00e1lise inconclusiva',
      pendente: 'Pendente',
      aprovado: 'Aprovado',
      rejeitado: 'Rejeitado'
    };
    return labels[String(status || 'pendente')] || String(status || 'pendente').replaceAll('_', ' ');
  }

  function formatOcrFieldLabel(field) {
    const labels = {
      'titulo do certificado': 't\u00edtulo do certificado',
      't\u00edtulo do certificado': 't\u00edtulo do certificado',
      'nome do participante': 'nome do participante',
      'carga horaria': 'carga hor\u00e1ria',
      'carga hor\u00e1ria': 'carga hor\u00e1ria',
      data: 'data',
      instituicao: 'institui\u00e7\u00e3o',
      institui\u00e7\u00e3o: 'institui\u00e7\u00e3o',
      'curso/evento': 'curso/evento'
    };
    const key = String(field || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return labels[key] || String(field || '').trim();
  }

  function formatOcrFieldList(fields) {
    const seen = new Set();
    return (Array.isArray(fields) ? fields : [])
      .map((field) => formatOcrFieldLabel(field))
      .filter(Boolean)
      .filter((field) => {
        const key = String(field).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
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

  function decorateCoordinatorAccents() {
    document.querySelectorAll('.coordinator-activity-form-card, #regras .dual-grid > .card:first-child, #oportunidades > .card').forEach((element) => applyAccentClass(element, 'orange'));
    document.querySelectorAll('.coordinator-flow-card, .coordinator-activity-list-card, #alunos .coordinator-students-shell > .card, #regras .dual-grid > .card:last-child').forEach((element) => applyAccentClass(element, 'info'));
    document.querySelectorAll('#envios > .card, #certificados > .card').forEach((element) => applyAccentClass(element, 'warning'));
    document.querySelectorAll('#metricsGrid .metric-card').forEach((element, index) => {
      const tones = ['warning', 'info', 'orange', 'green', 'info', 'warning'];
      applyAccentClass(element, tones[index] || 'orange');
    });
    document.querySelectorAll('#coordinatorCertificateStats .card').forEach((element, index) => {
      const tones = ['warning', 'info', 'green', 'danger'];
      applyAccentClass(element, tones[index] || 'orange');
    });
  }

  function buildCertificateSummary(certificate) {
    if (certificate.humanSummary) return certificate.humanSummary;
    const missingFields = formatOcrFieldList(certificate.missingFields);
    if (missingFields.length) return `Campos n\u00e3o identificados: ${missingFields.join(', ')}.`;
    return certificate.ocrReason || 'Aguardando pr\u00e9-an\u00e1lise do OCR.';
  }

  function getActivityLifecycleStatus(activity) {
    if (!activity?.prazo) return 'aberta';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(activity.prazo);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'encerrada';
    if (diffDays <= 7) return 'vence_em_breve';
    return 'aberta';
  }

  function getActivityLifecycleLabel(status) {
    return {
      aberta: 'Aberta',
      vence_em_breve: 'Vence em breve',
      encerrada: 'Encerrada'
    }[status] || 'Aberta';
  }

  function getCourseLabel(courseId) {
    const course = SIGACStore.getCourseById(courseId);
    if (!course) return 'Curso não identificado';
    return `${course.sigla} - ${course.nome}`;
  }

  function compareCertificatesByPriority(left, right) {
    const leftPending = left.adminStatus === 'pendente' ? 0 : 1;
    const rightPending = right.adminStatus === 'pendente' ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;

    const leftOcrAttention = ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(left.ocrStatus) ? 0 : 1;
    const rightOcrAttention = ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(right.ocrStatus) ? 0 : 1;
    if (leftOcrAttention !== rightOcrAttention) return leftOcrAttention - rightOcrAttention;

    return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
  }

  function setActiveSection(sectionId) {
    document.querySelectorAll('.panel-section').forEach((section) => section.classList.add('hidden'));
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.remove('active'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  }

  function getCurrentSectionId() {
    return document.querySelector('[data-section].active')?.dataset.section || 'dashboard';
  }

  function getSectionLoadingTarget(sectionId) {
    return {
      dashboard: 'studentsByCourse',
      alunos: 'coordinatorStudentsList',
      atividades: 'activitiesList',
      regras: 'rulesList',
      envios: 'pendingSubmissionsList',
      certificados: 'studentCertificatesList',
      oportunidades: 'opportunitiesList'
    }[sectionId] || '';
  }

  function showSectionLoading(sectionId, text = 'Carregando...') {
    const targetId = getSectionLoadingTarget(sectionId);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    target.innerHTML = `<div class="item small">${escapeHtml(text)}</div>`;
  }

  async function ensureSectionData(sectionId, options = {}) {
    if (sectionId === 'alunos') return SIGACStore.ensureCoordinatorTabData('students', options);
    if (sectionId === 'atividades') return SIGACStore.ensureCoordinatorTabData('activities', options);
    if (sectionId === 'regras') return SIGACStore.ensureCoordinatorTabData('rules', options);
    if (sectionId === 'envios') return SIGACStore.ensureCoordinatorTabData('submissions', options);
    if (sectionId === 'certificados') return SIGACStore.ensureCoordinatorTabData('certificates', options);
    if (sectionId === 'oportunidades') return SIGACStore.ensureCoordinatorTabData('opportunities', options);
    return null;
  }

  async function openSection(sectionId, options = {}) {
    const force = !!options.force;
    setActiveSection(sectionId);
    if (sectionId !== 'dashboard') showSectionLoading(sectionId, 'Carregando dados da aba...');
    await ensureSectionData(sectionId, { force });
    renderCoordinatorSummary(SIGACStore.getCurrentUser());
    renderCoordinatorSection(sectionId, SIGACStore.getCurrentUser());
    decorateCoordinatorAccents();
  }

  function renderCharts(data) {
    if (!window.Chart) return;
    window.SIGACCharts?.ensureDefaults();
    const statusCtx = document.getElementById('chartStatus').getContext('2d');
    const engagementCtx = document.getElementById('chartEngajamento').getContext('2d');
    const charts = window.SIGACCharts;

    if (chartStatus) chartStatus.destroy();
    if (chartEngajamento) chartEngajamento.destroy();

    chartStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Aprovados', 'Rejeitados', 'Em análise'],
        datasets: [{
          data: [data.aprovados, data.rejeitados, data.pendentes],
          backgroundColor: ['#22c55e', '#ef4444', '#f28c00'],
          borderColor: '#ffffff',
          borderWidth: 4,
          spacing: 3,
          borderRadius: 10,
          hoverOffset: 2
        }]
      },
      options: charts.createOptions({
        cutout: '72%',
        layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        plugins: {
          legend: charts.createLegend(),
          tooltip: charts.createTooltip({
            borderColor: 'rgba(15, 23, 42, 0.12)'
          })
        }
      })
    });

    chartEngajamento = new Chart(engagementCtx, {
      type: 'bar',
      data: {
        labels: ['Alunos com envio', 'Alunos sem envio'],
        datasets: [{
          label: 'Quantidade',
          data: [data.alunosComEnvio, data.alunosSemEnvio],
          backgroundColor: ['#1f5fa8', '#f28c00'],
          borderColor: ['#2f80d0', '#d97706'],
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 56,
          barPercentage: 0.74,
          categoryPercentage: 0.7
        }]
      },
      options: charts.createOptions({
        layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
        scales: {
          y: charts.createScale({
            beginAtZero: true,
            ticks: {
              precision: 0,
              stepSize: 1
            }
          }),
          x: charts.createScale({
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 12, weight: '600' }
            }
          })
        },
        plugins: {
          legend: { display: false },
          tooltip: charts.createTooltip({
            displayColors: false,
            borderColor: 'rgba(15, 23, 42, 0.12)'
          })
        }
      })
    });
  }

  function renderDashboard(user) {
    const startedAt = performance.now();
    const data = SIGACStore.getCoordinatorDashboardData(user.id);
    setUserIdentity(user, 'Coordenador');
    document.getElementById('coordinatorCoursesInfo').textContent = `Cursos vinculados: ${user.courseIds.map((id) => SIGACStore.getCourseById(id)?.sigla || id).join(', ') || 'Nenhum curso'}.`;
    document.getElementById('metricsGrid').innerHTML = `
      <div class="card metric-card"><h3>Pendentes</h3><div class="metric-value">${data.pendentes}</div><p class="small">Envios aguardando decisão</p></div>
      <div class="card metric-card"><h3>Total de alunos</h3><div class="metric-value">${data.totalAlunos}</div><p class="small">Sob sua coordenação</p></div>
      <div class="card metric-card"><h3>Atividades lançadas</h3><div class="metric-value">${data.totalAtividades}</div><p class="small">Disponíveis nos cursos vinculados</p></div>
      <div class="card metric-card"><h3>Aprovados</h3><div class="metric-value">${data.aprovados}</div><p class="small">Envios já validados</p></div>
      <div class="card metric-card"><h3>Taxa de aprovação</h3><div class="metric-value">${data.taxaAprovacao || 0}%</div><p class="small">Sobre envios avaliados</p></div>
      <div class="card metric-card"><h3>Certificados</h3><div class="metric-value">${data.certificadosPendentes || 0}</div><p class="small">Aguardando revisão</p></div>
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
    logPerf('renderDashboard', startedAt);
  }

  function renderActivities(user) {
    const activities = SIGACStore.listActivitiesForCoordinator(user.id);
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
    const courseFilter = document.getElementById('coordinatorActivityCourseFilter');
    const statusFilter = document.getElementById('coordinatorActivityStatusFilter');
    const courses = Array.from(new Map(activities
      .map((activity) => [activity.courseId, SIGACStore.getCourseById(activity.courseId)])
      .filter(([, course]) => course?.id)).values());
    const activitiesWithMeta = activities.map((activity) => {
      const course = SIGACStore.getCourseById(activity.courseId);
      const status = getActivityLifecycleStatus(activity);
      const relatedSubmissions = submissions.filter((submission) => submission.activity?.id === activity.id);
      return {
        ...activity,
        course,
        status,
        submissionCount: relatedSubmissions.length
      };
    });

    if (courseFilter) {
      courseFilter.innerHTML = '<option value="todos">Todos os cursos</option>' + courses
        .map((course) => `<option value="${course.id}" ${course.id === coordinatorActivityCourseFilter ? 'selected' : ''}>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome || '')}</option>`).join('');
    }
    if (statusFilter) statusFilter.value = coordinatorActivityStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visibleActivities = activitiesWithMeta.filter((activity) => {
      const searchableText = normalize(`${activity.titulo} ${activity.descricao} ${activity.materialNome || ''} ${activity.course?.sigla || ''} ${activity.course?.nome || ''}`);
      const matchesSearch = !coordinatorActivitySearchTerm || searchableText.includes(normalize(coordinatorActivitySearchTerm));
      const matchesCourse = coordinatorActivityCourseFilter === 'todos' || activity.courseId === coordinatorActivityCourseFilter;
      const matchesStatus = coordinatorActivityStatusFilter === 'todos' || activity.status === coordinatorActivityStatusFilter;
      return matchesSearch && matchesCourse && matchesStatus;
    });

    document.getElementById('coordinatorActivitiesHighlights').innerHTML = `
      <span class="summary-chip">Atividades <strong>${activitiesWithMeta.length}</strong></span>
      <span class="summary-chip">Abertas <strong>${activitiesWithMeta.filter((activity) => activity.status === 'aberta').length}</strong></span>
      <span class="summary-chip">Vencem em breve <strong>${activitiesWithMeta.filter((activity) => activity.status === 'vence_em_breve').length}</strong></span>
      <span class="summary-chip">Com envios <strong>${activitiesWithMeta.filter((activity) => activity.submissionCount > 0).length}</strong></span>
    `;
    document.getElementById('coordinatorActivityFilterResult').textContent = `${visibleActivities.length} de ${activitiesWithMeta.length} atividades exibidas`;

    document.getElementById('activitiesList').innerHTML = visibleActivities.length
      ? visibleActivities.map((activity) => `
          <article class="activity-card coordinator-activity-card accent-card ${activity.status === 'encerrada' ? 'accent-card--danger' : activity.status === 'vence_em_breve' ? 'accent-card--warning' : 'accent-card--green'}">
            <div class="activity-card-top">
              <div class="activity-card-heading">
                <div class="coordinator-activity-title-row">
                  <h4 title="${escapeHtml(activity.titulo)}">${escapeHtml(activity.titulo)}</h4>
                  <span class="badge coordinator-activity-course-badge">${escapeHtml(activity.course?.sigla || '-')}</span>
                </div>
                <p title="${escapeHtml(activity.descricao)}">${escapeHtml(activity.descricao)}</p>
              </div>
              <div class="activity-status">
                <span class="badge ${activity.status === 'encerrada' ? 'rejeitado' : activity.status === 'vence_em_breve' ? 'em_analise' : 'aprovado'}">${escapeHtml(getActivityLifecycleLabel(activity.status))}</span>
              </div>
            </div>
            <div class="activity-card-main">
              <div class="activity-meta-grid coordinator-activity-meta-grid">
                <div class="activity-meta-card accent-card accent-card--info">
                  <span>Curso</span>
                  <strong title="${escapeHtml(activity.course?.nome || 'Curso não identificado')}">${escapeHtml(activity.course?.nome || 'Curso não identificado')}</strong>
                </div>
                <div class="activity-meta-card accent-card">
                  <span>Horas</span>
                  <strong>${Number(activity.horas || 0)}h</strong>
                </div>
                <div class="activity-meta-card ${activity.status === 'encerrada' ? 'deadline-late' : activity.status === 'vence_em_breve' ? 'deadline-soon' : 'deadline-open'} accent-card ${activity.status === 'encerrada' ? 'accent-card--danger' : activity.status === 'vence_em_breve' ? 'accent-card--warning' : 'accent-card--green'}">
                  <span>Prazo</span>
                  <strong>${activity.prazo ? escapeHtml(new Date(activity.prazo).toLocaleDateString('pt-BR')) : 'Sem prazo'}</strong>
                </div>
                <div class="activity-meta-card accent-card accent-card--info">
                  <span>Material</span>
                  <strong title="${escapeHtml(activity.materialNome || 'Não anexado')}">${escapeHtml(activity.materialNome || 'Não anexado')}</strong>
                </div>
                <div class="activity-meta-card accent-card accent-card--warning">
                  <span>Envios</span>
                  <strong>${activity.submissionCount}</strong>
                </div>
              </div>
              <div class="activity-support-row">
                <div class="activity-support">
                  <span class="small">Curso completo: ${escapeHtml(activity.course?.nome || 'Não identificado')}</span>
                  <p class="activity-latest">${activity.submissionCount ? `Já existem ${activity.submissionCount} envio(s) relacionado(s) a esta atividade.` : 'Ainda não há envios vinculados a esta atividade.'}</p>
                </div>
                <div class="actions-row activity-actions">
                  ${activity.materialNome ? `<button type="button" class="button secondary activity-material-btn" data-activity-id="${activity.id}">Baixar material</button>` : '<span class="activity-material-empty">Sem material de apoio</span>'}
                </div>
              </div>
            </div>
          </article>
        `).join('')
      : `
        <div class="activity-empty-state">
          <div class="activity-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhuma atividade encontrada</h3>
          <p>Ajuste a busca ou os filtros para localizar outra atividade publicada nos seus cursos.</p>
        </div>
      `;

    document.querySelectorAll('.activity-material-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openActivityMaterial(button.dataset.activityId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderRules(user) {
    const rules = SIGACStore.listCoordinatorRules();
    document.getElementById('rulesList').innerHTML = rules.length
      ? rules.map((rule) => `
          <article class="coordinator-rule-card accent-card accent-card--info">
            <div class="coordinator-rule-card-top">
              <div>
                <div class="eyebrow">Regra ativa</div>
                <h3>${escapeHtml(rule.categoria)}</h3>
              </div>
              <div class="coordinator-rule-badges">
                <span class="badge em_analise">${escapeHtml(SIGACStore.getCourseById(rule.courseId)?.sigla || rule.courseId)}</span>
                <span class="badge aprovado">${escapeHtml(rule.categoria)}</span>
              </div>
            </div>
            <div class="coordinator-rule-meta">
              <div class="coordinator-rule-meta-card accent-card accent-card--info">
                <span>Curso</span>
                <strong>${escapeHtml(SIGACStore.getCourseById(rule.courseId)?.nome || rule.courseId)}</strong>
              </div>
              <div class="coordinator-rule-meta-card accent-card">
                <span>Carga minima</span>
                <strong>${rule.cargaMinima || 0}h</strong>
              </div>
              <div class="coordinator-rule-meta-card accent-card accent-card--warning">
                <span>Limite maximo</span>
                <strong>${rule.limiteMaximo || 0}h</strong>
              </div>
            </div>
            <div class="coordinator-rule-flags">
              <span class="summary-chip">${rule.exigeCertificado ? 'Certificado obrigatorio' : 'Certificado opcional'}</span>
              <span class="summary-chip">${rule.exigeAprovacao ? 'Aprovacao do coordenador' : 'Aprovacao automatica'}</span>
            </div>
          </article>
        `).join('')
      : `
        <div class="coordinator-rule-empty">
          <div class="coordinator-rule-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhuma regra cadastrada</h3>
          <p>Crie a primeira regra para orientar como as horas e comprovacoes devem ser avaliadas em cada curso.</p>
        </div>
      `;
  }

  function renderStudentsPanel(user) {
    const startedAt = performance.now();
    const data = SIGACStore.getCoordinatorDashboardData(user.id);
    const submissions = ensureArray(data.submissions);
    const students = ensureArray(data.students).map((student) => {
      const studentSubmissions = submissions
        .filter((submission) => submission.student?.id === student.id)
        .sort((a, b) => new Date(b.latest?.enviadaEm || 0) - new Date(a.latest?.enviadaEm || 0));
      const latestSubmission = studentSubmissions[0] || null;
      const pendingCount = studentSubmissions.filter((submission) => ['em_analise', 'rejeitado'].includes(submission.latest?.status)).length;
      return {
        ...student,
        latestSubmission,
        pendingCount,
        totalSubmissions: studentSubmissions.length
      };
    });

    const visible = students.filter((student) => {
      const text = normalize(`${student.nome} ${student.email} ${student.course?.sigla || ''} ${student.course?.nome || ''}`);
      const matchesSearch = !coordinatorStudentSearchTerm || text.includes(normalize(coordinatorStudentSearchTerm));
      const matchesCourse = coordinatorStudentCourseFilter === 'todos' || student.course?.id === coordinatorStudentCourseFilter;
      return matchesSearch && matchesCourse;
    });

    document.getElementById('coordinatorStudentsHighlights').innerHTML = `
      <span class="summary-chip">Alunos <strong>${students.length}</strong></span>
      <span class="summary-chip">Com pendências <strong>${students.filter((student) => student.pendingCount > 0).length}</strong></span>
      <span class="summary-chip">Sem envio <strong>${students.filter((student) => !student.totalSubmissions).length}</strong></span>
    `;

    document.getElementById('coordinatorStudentFilterResult').textContent = `${visible.length} de ${students.length} alunos exibidos`;

    document.getElementById('coordinatorStudentsList').innerHTML = visible.length
      ? visible.map((student) => `
          <article class="coordinator-student-card accent-card ${student.pendingCount ? 'accent-card--warning' : 'accent-card--green'}">
            <div class="coordinator-student-card-top">
              <div>
                <h3>${escapeHtml(student.nome)}</h3>
                <p>${escapeHtml(student.email)}</p>
              </div>
              <span class="badge ${student.pendingCount ? 'em_analise' : 'aprovado'}">${student.pendingCount ? `${student.pendingCount} pendência(s)` : 'Em dia'}</span>
            </div>
            <div class="coordinator-student-meta">
              <div class="coordinator-student-meta-card accent-card accent-card--info">
                <span>Curso</span>
                <strong>${escapeHtml(student.course?.sigla || '-')}</strong>
              </div>
              <div class="coordinator-student-meta-card accent-card">
                <span>Horas concluidas</span>
                <strong>${student.progress?.total || 0}h</strong>
              </div>
              <div class="coordinator-student-meta-card accent-card accent-card--warning">
                <span>Meta</span>
                <strong>${student.progress?.target || 0}h</strong>
              </div>
            </div>
            <div class="progress coordinator-student-progress"><span style="width:${student.progress?.percent || 0}%"></span></div>
            <div class="coordinator-student-foot">
              <div class="coordinator-student-last">
                <span>Último envio</span>
                <strong>${student.latestSubmission ? escapeHtml(student.latestSubmission.activity?.titulo || 'Atividade') : 'Nenhum envio'}</strong>
                <p class="small">${student.latestSubmission ? `Status: ${escapeHtml(String(student.latestSubmission.latest?.status || 'em_analise').replaceAll('_', ' '))} | ${formatDate(student.latestSubmission.latest?.enviadaEm)}` : 'O aluno ainda não enviou comprovantes.'}</p>
              </div>
            </div>
          </article>
        `).join('')
      : `
        <div class="coordinator-student-empty">
          <div class="coordinator-student-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhum aluno encontrado</h3>
          <p>Ajuste a busca ou o filtro por curso para visualizar outros alunos vinculados.</p>
        </div>
      `;
    logPerf('renderStudentsPanel', startedAt);
  }

  function renderSubmissions(user) {
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
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
            ${submission.latest?.status === 'em_analise'
              ? `<form class="evaluation-form" data-submission-id="${submission.id}" style="margin-top:12px;">
                   <div class="field"><label>Feedback</label><textarea name="feedback" placeholder="Comentário para o aluno"></textarea></div>
                   <div class="actions-row">
                     <button type="button" class="approve-btn success">Aprovar</button>
                     <button type="button" class="reject-btn danger">Rejeitar</button>
                   </div>
                 </form>`
              : `<p class="small"><strong>Feedback:</strong> ${escapeHtml(submission.latest?.feedback || 'Sem observações.')}</p>`}
          </div>
        `).join('')
      : '<div class="item">Nenhum envio encontrado.</div>';

    container.querySelectorAll('.evaluation-form').forEach((form) => {
      const feedback = () => form.querySelector('textarea').value;
      form.querySelector('.approve-btn').addEventListener('click', async () => {
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'aprovado', feedback());
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
      form.querySelector('.reject-btn').addEventListener('click', async () => {
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderAll(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderCertificates(user) {
    const list = SIGACStore.listCertificatesForUser(user.id);
    document.getElementById('certificatesList').innerHTML = list.length
      ? list.map((certificate) => `
          <div class="item">
            <h4>${escapeHtml(certificate.fileName)}</h4>
            <p class="meta">Enviado em ${formatDate(certificate.createdAt)} | Horas declaradas: ${certificate.declaredHours || 0}h</p>
            <p><strong>OCR:</strong> <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</span></p>
            <p><strong>Admin:</strong> <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(certificate.adminStatus.replaceAll('_', ' '))}</span></p>
            <p class="small">${escapeHtml(buildCertificateSummary(certificate))}</p>
            ${certificate.adminFeedback ? `<p class="small"><strong>Feedback:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
            <div class="actions-row"><button type="button" class="secondary open-own-cert-btn" data-certificate-id="${certificate.id}">Abrir certificado</button></div>
          </div>
        `).join('')
      : '<div class="item">Você ainda não enviou certificados para o administrador.</div>';
    document.querySelectorAll('.open-own-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCertificateFile(button.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderStudentCertificates(user) {
    const allCertificates = SIGACStore.listCertificatesForCoordinatorReview();
    const certificates = allCertificates.filter((certificate) => certificate.adminStatus === 'pendente');
    const container = document.getElementById('studentCertificatesList');
    document.getElementById('coordinatorCertificateStats').innerHTML = `
      <div class="card"><h3>Pendentes</h3><div class="metric-value">${allCertificates.filter((item) => item.adminStatus === 'pendente').length}</div></div>
      <div class="card"><h3>OCR aprovado automaticamente</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'aprovado_automatico').length}</div></div>
      <div class="card"><h3>OCR em revisão manual</h3><div class="metric-value">${allCertificates.filter((item) => item.ocrStatus === 'analise_manual').length}</div></div>
      <div class="card"><h3>Rejeitados</h3><div class="metric-value">${allCertificates.filter((item) => item.adminStatus === 'rejeitado').length}</div></div>
    `;

    container.innerHTML = certificates.length
      ? certificates.map((certificate) => `
          <div class="item" data-certificate-id="${certificate.id}">
            <h4>${escapeHtml(certificate.fileName)}</h4>
            <p><strong>Enviado por:</strong> ${escapeHtml(certificate.sender?.nome || 'Aluno removido')} (${escapeHtml(certificate.senderType || 'aluno')})</p>
            <p class="meta">Enviado em ${formatDate(certificate.createdAt)} | Horas declaradas: ${certificate.declaredHours || 0}h</p>
            <p><strong>OCR:</strong> <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</span></p>
            <p><strong>Admin:</strong> <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(statusLabel(certificate.adminStatus))}</span></p>
            <p class="small"><strong>Resumo:</strong> ${escapeHtml(buildCertificateSummary(certificate))}</p>
            <div class="ocr-compare">
              <div><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
              <div><span>Nome da atividade</span><span>${escapeHtml(certificate.observation || 'Não informado')}</span><span>${escapeHtml(certificate.detectedTitle || 'Não identificado')}</span></div>
              <div><span>Carga horária</span><span>${certificate.declaredHours || 0}h</span><span>${certificate.detectedHours || 0}h</span></div>
              <div><span>Institui\u00e7\u00e3o</span><span>N\u00e3o informado</span><span>${escapeHtml(certificate.detectedInstitution || 'N\u00e3o identificada')}</span></div>
              <div><span>Data</span><span>${formatDate(certificate.createdAt)}</span><span>${escapeHtml(certificate.detectedDate || 'Não identificada')}</span></div>
            </div>
            ${certificate.adminFeedback ? `<p class="small"><strong>Feedback:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
            <div class="actions-row">
              <button type="button" class="secondary open-student-cert-btn">Abrir arquivo</button>
              <button type="button" class="success approve-student-cert-btn">Aprovar</button>
              <button type="button" class="danger reject-student-cert-btn">Rejeitar</button>
            </div>
            <div class="field" style="margin-top:12px;"><label>Feedback</label><textarea class="student-certificate-feedback" placeholder="Comentário para o aluno">${escapeHtml(certificate.adminFeedback || '')}</textarea></div>
          </div>
        `).join('')
      : '<div class="item">Nenhum certificado pendente no momento.</div>';

    container.querySelectorAll('.open-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.openCoordinatorCertificateFile(card.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.approve-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, card.dataset.certificateId, 'aprovado', card.querySelector('.student-certificate-feedback').value);
          renderAll(SIGACStore.getCurrentUser());
          setActiveSection('certificados');
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.reject-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, card.dataset.certificateId, 'rejeitado', card.querySelector('.student-certificate-feedback').value);
          renderAll(SIGACStore.getCurrentUser());
          setActiveSection('certificados');
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupCertificateForm(user) {
    const form = document.getElementById('certificateForm');
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
        showMessage('certificateMessage', 'Certificado enviado ao administrador com sucesso.', 'success');
        renderAll(SIGACStore.getCurrentUser());
      } catch (error) {
        showMessage('certificateMessage', error.message, 'error');
      }
    });
  }

  function renderStudentCertificates(user) {
    const allCertificates = SIGACStore.listCertificatesForCoordinatorReview();
    const sortedCertificates = [...allCertificates].sort(compareCertificatesByPriority);
    const container = document.getElementById('studentCertificatesList');
    const courseSelect = document.getElementById('coordinatorCertificateCourseFilter');
    const uniqueCourseIds = [...new Set(sortedCertificates.map((certificate) => certificate.sender?.courseId).filter(Boolean))];

    if (courseSelect) {
      const previousValue = courseSelect.value || certificateCourseFilter;
      courseSelect.innerHTML = `
        <option value="todos">Todos os cursos</option>
        ${uniqueCourseIds.map((courseId) => `<option value="${courseId}">${escapeHtml(getCourseLabel(courseId))}</option>`).join('')}
      `;
      const hasPrevious = previousValue === 'todos' || uniqueCourseIds.includes(previousValue);
      courseSelect.value = hasPrevious ? previousValue : 'todos';
      certificateCourseFilter = courseSelect.value;
      if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();
    }

    const visibleCertificates = sortedCertificates.filter((certificate) => {
      const searchableText = normalize([
        certificate.sender?.nome,
        certificate.sender?.email,
        certificate.fileName,
        certificate.observation,
        certificate.detectedTitle,
        certificate.detectedInstitution
      ].join(' '));
      const matchesStudent = !certificateStudentSearchTerm || searchableText.includes(normalize(certificateStudentSearchTerm));
      const matchesStatus = certificateStatusFilter === 'todos' || certificate.adminStatus === certificateStatusFilter;
      const matchesCourse = certificateCourseFilter === 'todos' || certificate.sender?.courseId === certificateCourseFilter;
      return matchesStudent && matchesStatus && matchesCourse;
    });

    const pendingCertificates = sortedCertificates.filter((item) => item.adminStatus === 'pendente');
    const approvedByCoordinator = sortedCertificates.filter((item) => item.adminStatus === 'aprovado').length;
    const rejectedByCoordinator = sortedCertificates.filter((item) => item.adminStatus === 'rejeitado').length;
    const ocrAttentionCount = sortedCertificates.filter((item) => ['analise_manual', 'rejeitado_automatico', 'nao_processado'].includes(item.ocrStatus)).length;

    document.getElementById('coordinatorCertificateStats').innerHTML = `
      <div class="card metric-card accent-card accent-card--warning"><h3>Pendentes</h3><div class="metric-value">${pendingCertificates.length}</div><p class="small">Aguardando sua decisão</p></div>
      <div class="card metric-card accent-card accent-card--info"><h3>OCR pede revisão</h3><div class="metric-value">${ocrAttentionCount}</div><p class="small">Analise manual ou alerta</p></div>
      <div class="card metric-card accent-card accent-card--green"><h3>Aprovados</h3><div class="metric-value">${approvedByCoordinator}</div><p class="small">Ja liberados pelo coordenador</p></div>
      <div class="card metric-card accent-card accent-card--danger"><h3>Rejeitados</h3><div class="metric-value">${rejectedByCoordinator}</div><p class="small">Com retorno ao aluno</p></div>
    `;

    document.getElementById('coordinatorCertificateHighlights').innerHTML = `
      <span class="summary-chip">Na fila <strong>${sortedCertificates.length}</strong></span>
      <span class="summary-chip">Exibidos <strong>${visibleCertificates.length}</strong></span>
      <span class="summary-chip">OCR automático <strong>${sortedCertificates.filter((item) => item.ocrStatus === 'aprovado_automatico').length}</strong></span>
      <span class="summary-chip">Cursos <strong>${uniqueCourseIds.length}</strong></span>
    `;
    document.getElementById('coordinatorCertificateFilterResult').textContent = `${visibleCertificates.length} de ${sortedCertificates.length} certificados exibidos`;

    container.innerHTML = visibleCertificates.length
      ? visibleCertificates.map((certificate) => {
          const isPending = certificate.adminStatus === 'pendente';
          const courseLabel = getCourseLabel(certificate.sender?.courseId);
          const statusToneClass = isPending ? 'certificate-card-pending' : certificate.adminStatus === 'aprovado' ? 'certificate-card-approved' : 'certificate-card-rejected';
          return `
            <article class="coordinator-certificate-card accent-card ${statusToneClass} ${certificate.adminStatus === 'aprovado' ? 'accent-card--green' : certificate.adminStatus === 'rejeitado' ? 'accent-card--danger' : 'accent-card--warning'}" data-certificate-id="${certificate.id}">
              <div class="coordinator-certificate-card-top">
                <div>
                  <div class="eyebrow">Revisao de certificado</div>
                  <h3>${escapeHtml(certificate.sender?.nome || 'Aluno removido')}</h3>
                  <p>${escapeHtml(certificate.sender?.email || 'Sem e-mail')} | ${escapeHtml(courseLabel)}</p>
                </div>
                <div class="coordinator-certificate-badges">
                  <span class="badge ${badgeClass(certificate.adminStatus)}">${escapeHtml(statusLabel(certificate.adminStatus))}</span>
                  <span class="badge ${badgeClass(certificate.ocrStatus)}">${escapeHtml(statusLabel(certificate.ocrStatus))}</span>
                </div>
              </div>
              <div class="coordinator-certificate-meta">
                <div class="coordinator-certificate-meta-card accent-card accent-card--info">
                  <span>Arquivo</span>
                  <strong>${escapeHtml(certificate.fileName)}</strong>
                </div>
                <div class="coordinator-certificate-meta-card accent-card">
                  <span>Horas declaradas</span>
                  <strong>${certificate.declaredHours || 0}h</strong>
                </div>
                <div class="coordinator-certificate-meta-card accent-card accent-card--warning">
                  <span>Enviado em</span>
                  <strong>${formatDate(certificate.createdAt)}</strong>
                </div>
                <div class="coordinator-certificate-meta-card accent-card accent-card--info">
                  <span>Status OCR</span>
                  <strong>${escapeHtml(statusLabel(certificate.ocrStatus))}</strong>
                </div>
                <div class="coordinator-certificate-meta-card accent-card ${certificate.ocrStatus === 'aprovado_automatico' ? 'accent-card--green' : ['analise_manual', 'nao_processado', 'rejeitado_automatico'].includes(certificate.ocrStatus) ? 'accent-card--warning' : 'accent-card'}">
                  <span>Status admin</span>
                  <strong>${escapeHtml(statusLabel(certificate.adminStatus))}</strong>
                </div>
                <div class="coordinator-certificate-meta-card accent-card ${certificate.adminStatus === 'rejeitado' ? 'accent-card--danger' : certificate.adminStatus === 'aprovado' ? 'accent-card--green' : 'accent-card--warning'}">
                  <span>Horas OCR</span>
                  <strong>${certificate.detectedHours || 0}h</strong>
                </div>
              </div>
              <div class="coordinator-certificate-summary">
                <div>
                  <span>Resumo OCR</span>
                  <p>${escapeHtml(buildCertificateSummary(certificate))}</p>
                </div>
                <div>
                  <span>Descri\u00e7\u00e3o do aluno</span>
                  <p>${escapeHtml(certificate.observation || 'Não informada')}</p>
                </div>
              </div>
              <div class="ocr-compare">
                <div><strong>Campo</strong><strong>Informado</strong><strong>Detectado pelo OCR</strong></div>
                <div><span>Nome da atividade</span><span>${escapeHtml(certificate.observation || 'Não informado')}</span><span>${escapeHtml(certificate.detectedTitle || 'Não identificado')}</span></div>
                <div><span>Carga horaria</span><span>${certificate.declaredHours || 0}h</span><span>${certificate.detectedHours || 0}h</span></div>
                <div><span>Institui\u00e7\u00e3o</span><span>N\u00e3o informado</span><span>${escapeHtml(certificate.detectedInstitution || 'N\u00e3o identificada')}</span></div>
                <div><span>Data</span><span>${formatDate(certificate.createdAt)}</span><span>${escapeHtml(certificate.detectedDate || 'Não identificada')}</span></div>
              </div>
              ${certificate.adminFeedback ? `<p class="small"><strong>Feedback atual:</strong> ${escapeHtml(certificate.adminFeedback)}</p>` : ''}
              <div class="actions-row coordinator-certificate-actions">
                <button type="button" class="secondary open-student-cert-btn">Abrir arquivo</button>
                <button type="button" class="secondary run-ocr-btn">Processar OCR</button>
                ${isPending ? '<button type="button" class="success approve-student-cert-btn">Aprovar</button><button type="button" class="danger reject-student-cert-btn">Rejeitar</button>' : ''}
              </div>
              <div class="field coordinator-certificate-feedback-field">
                <label>Feedback</label>
                <textarea class="student-certificate-feedback" placeholder="Comentário para o aluno" ${isPending ? '' : 'disabled'}>${escapeHtml(certificate.adminFeedback || '')}</textarea>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="coordinator-certificate-empty">
          <div class="coordinator-certificate-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhum certificado encontrado</h3>
          <p>Ajuste os filtros de status, aluno ou curso para localizar outro certificado na fila.</p>
        </div>
      `;

    container.querySelectorAll('.open-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.openCoordinatorCertificateFile(card.dataset.certificateId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.run-ocr-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const dashboard = SIGACStore.getCoordinatorDashboardData();
        const card = button.closest('[data-certificate-id]');
        const certificateId = card.dataset.certificateId;
        const current = (dashboard.certificatesToReview || []).find((item) => item.id === certificateId);
        if (!current) return;
        if (!dashboard.settings?.ocrDisponivel) {
          showMessage('certificateMessage', 'Ative o OCR nas configurações antes de processar certificados.', 'error');
          return;
        }

        button.disabled = true;
        button.textContent = 'Processando...';
        try {
          const file = await SIGACStore.getCoordinatorCertificateFile(current.id);
          const result = await window.SIGACOCR.analyzeCertificateData(file.fileData, { expectedName: current.sender?.nome || '' });
          await SIGACStore.saveCoordinatorCertificateOcrResult(user.id, current.id, result);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          showMessage('certificateMessage', `Falha no OCR: ${error.message}`, 'error');
        } finally {
          button.disabled = false;
          button.textContent = 'Processar OCR';
        }
      });
    });

    container.querySelectorAll('.approve-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, card.dataset.certificateId, 'aprovado', card.querySelector('.student-certificate-feedback').value);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.reject-student-cert-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-certificate-id]');
        try {
          await SIGACStore.reviewCoordinatorCertificate(user.id, card.dataset.certificateId, 'rejeitado', card.querySelector('.student-certificate-feedback').value);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderStudentCertificates(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupCertificateReviewControls() {
    const refresh = () => renderStudentCertificates(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorCertificateStudentSearch')?.addEventListener('input', (event) => {
      certificateStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorCertificateStatusFilter')?.addEventListener('change', (event) => {
      certificateStatusFilter = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorCertificateCourseFilter')?.addEventListener('change', (event) => {
      certificateCourseFilter = event.target.value;
      refresh();
    });
  }

  function renderOpportunities(user) {
    const container = document.getElementById('opportunitiesList');
    const statusFilter = document.getElementById('coordinatorOpportunityStatusFilter');
    const opportunities = SIGACStore.listOpportunities().map((opportunity) => {
      const enrolled = opportunity.inscritos.includes(user.id);
      return {
        ...opportunity,
        enrolled,
        totalInscritos: Array.isArray(opportunity.inscritos) ? opportunity.inscritos.length : 0
      };
    });

    if (statusFilter) statusFilter.value = coordinatorOpportunityStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visibleOpportunities = opportunities.filter((opportunity) => {
      const searchableText = normalize(`${opportunity.titulo} ${opportunity.descricao}`);
      const matchesSearch = !coordinatorOpportunitySearchTerm || searchableText.includes(normalize(coordinatorOpportunitySearchTerm));
      const matchesStatus = coordinatorOpportunityStatusFilter === 'todos'
        || (coordinatorOpportunityStatusFilter === 'inscrito' && opportunity.enrolled)
        || (coordinatorOpportunityStatusFilter === 'disponível' && !opportunity.enrolled)
        || (coordinatorOpportunityStatusFilter === 'com_inscritos' && opportunity.totalInscritos > 0);
      return matchesSearch && matchesStatus;
    });

    document.getElementById('coordinatorOpportunityHighlights').innerHTML = `
      <span class="summary-chip">Oportunidades <strong>${opportunities.length}</strong></span>
      <span class="summary-chip">Disponíveis <strong>${opportunities.filter((item) => !item.enrolled).length}</strong></span>
      <span class="summary-chip">Minhas inscrições <strong>${opportunities.filter((item) => item.enrolled).length}</strong></span>
      <span class="summary-chip">Com inscritos <strong>${opportunities.filter((item) => item.totalInscritos > 0).length}</strong></span>
    `;
    document.getElementById('coordinatorOpportunityFilterResult').textContent = `${visibleOpportunities.length} de ${opportunities.length} oportunidades exibidas`;

    container.innerHTML = visibleOpportunities.length
      ? visibleOpportunities.map((opportunity) => {
          const enrolled = opportunity.enrolled;
          return `
            <article class="opportunity-card coordinator-opportunity-card accent-card ${enrolled ? 'enrolled accent-card--green' : 'accent-card'}">
              <div class="opportunity-card-head">
                <div>
                  <div class="eyebrow">Oportunidade publicada</div>
                  <h3>${escapeHtml(opportunity.titulo)}</h3>
                </div>
                <span class="badge ${enrolled ? 'aprovado' : 'em_analise'}">${enrolled ? 'Inscrito' : 'Disponível'}</span>
              </div>
              <p class="coordinator-opportunity-description">${escapeHtml(opportunity.descricao)}</p>
              <div class="coordinator-opportunity-meta">
                <div class="coordinator-opportunity-meta-card accent-card">
                  <span>Horas</span>
                  <strong>${opportunity.horas}h</strong>
                </div>
                <div class="coordinator-opportunity-meta-card accent-card ${enrolled ? 'accent-card--green' : 'accent-card--info'}">
                  <span>Status</span>
                  <strong>${enrolled ? 'Inscrito' : 'Disponível'}</strong>
                </div>
                <div class="coordinator-opportunity-meta-card accent-card accent-card--warning">
                  <span>Inscritos</span>
                  <strong>${opportunity.totalInscritos}</strong>
                </div>
              </div>
              <p class="opportunity-meta">${opportunity.totalInscritos ? `${opportunity.totalInscritos} participante(s) já demonstraram interesse.` : 'Ainda não há inscritos nesta oportunidade.'}</p>
              <div class="opportunity-card-actions">
                <button class="toggle-opp ${enrolled ? 'secondary opportunity-unenroll' : ''}" data-id="${opportunity.id}">${enrolled ? 'Desinscrever' : 'Inscrever-se'}</button>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="opportunity-empty coordinator-opportunity-empty">
          <div class="opportunity-empty-icon" aria-hidden="true">/</div>
          <h3>Nenhuma oportunidade encontrada</h3>
          <p>Ajuste a busca ou o filtro para visualizar outras oportunidades publicadas no sistema.</p>
        </div>
      `;

    container.querySelectorAll('.toggle-opp').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.toggleOpportunity(user.id, button.dataset.id);
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderOpportunities(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function setupOpportunityControls() {
    const refresh = () => renderOpportunities(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorOpportunitySearchInput')?.addEventListener('input', (event) => {
      coordinatorOpportunitySearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorOpportunityStatusFilter')?.addEventListener('change', (event) => {
      coordinatorOpportunityStatusFilter = event.target.value;
      refresh();
    });
  }

  function populateCourseSelects(user) {
    const courses = user.courseIds.map((courseId) => SIGACStore.getCourseById(courseId)).filter(Boolean);
    const options = '<option value="">Selecione um curso...</option>' + courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    const filterOptions = '<option value="todos">Todos os cursos</option>' + courses.map((course) => `<option value="${course.id}">${escapeHtml(course.sigla)} - ${escapeHtml(course.nome)}</option>`).join('');
    document.getElementById('courseId').innerHTML = options;
    document.getElementById('studentCourseInput').innerHTML = options;
    document.getElementById('ruleCourseInput').innerHTML = options;
    const studentFilter = document.getElementById('coordinatorStudentCourseFilter');
    if (studentFilter) studentFilter.innerHTML = filterOptions;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();
  }

  function setupStudentPanelControls() {
    const refresh = () => renderStudentsPanel(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorStudentSearchInput')?.addEventListener('input', (event) => {
      coordinatorStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorStudentCourseFilter')?.addEventListener('change', (event) => {
      coordinatorStudentCourseFilter = event.target.value;
      refresh();
    });
  }

  function setupStudentForm(user) {
    const form = document.getElementById('studentForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createCoordinatorStudent({
          nome: document.getElementById('studentNameInput').value,
          email: document.getElementById('studentEmailInput').value,
          senha: document.getElementById('studentPasswordInput').value,
          courseId: document.getElementById('studentCourseInput').value
        });
        form.reset();
        showMessage('studentFormMessage', 'Aluno cadastrado e vinculado ao curso com sucesso.', 'success');
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderStudentsPanel(freshUser);
      } catch (error) {
        showMessage('studentFormMessage', error.message, 'error');
      }
    });
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
        await SIGACStore.createActivity(user.id, {
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
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderActivities(freshUser);
      } catch (error) {
        showMessage('activityMessage', error.message, 'error');
      }
    });
  }

  function setupRuleForm(user) {
    const form = document.getElementById('ruleForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await SIGACStore.createCoordinatorRule({
          courseId: document.getElementById('ruleCourseInput').value,
          categoria: document.getElementById('ruleCategoryInput').value,
          cargaMinima: document.getElementById('ruleMinHours').value,
          limiteMaximo: document.getElementById('ruleMaxHours').value,
          exigeCertificado: document.getElementById('ruleRequiresCertificate').checked,
          exigeAprovacao: document.getElementById('ruleRequiresApproval').checked
        });
        form.reset();
        document.getElementById('ruleRequiresCertificate').checked = true;
        document.getElementById('ruleRequiresApproval').checked = true;
        showMessage('ruleMessage', 'Regra cadastrada com sucesso.', 'success');
        const freshUser = SIGACStore.getCurrentUser();
        populateCourseSelects(freshUser);
        renderCoordinatorSummary(freshUser);
        renderRules(freshUser);
      } catch (error) {
        showMessage('ruleMessage', error.message, 'error');
      }
    });
  }

  function renderSubmissions(user) {
    const startedAt = performance.now();
    const submissions = ensureArray(SIGACStore.getCoordinatorDashboardData(user.id).submissions);
    const container = document.getElementById('pendingSubmissionsList');
    const courses = Array.from(new Map(submissions
      .filter((submission) => submission.course?.id)
      .map((submission) => [submission.course.id, submission.course])).values());
    const activities = Array.from(new Map(submissions
      .filter((submission) => submission.activity?.id)
      .map((submission) => [submission.activity.id, submission.activity])).values());
    const courseFilter = document.getElementById('submissionCourseFilter');
    const activityFilter = document.getElementById('submissionActivityFilter');
    const statusFilter = document.getElementById('submissionStatusFilter');

    if (courseFilter) {
      courseFilter.innerHTML = '<option value="todos">Todos os cursos</option>' + courses
        .map((course) => `<option value="${course.id}" ${course.id === submissionCourseFilter ? 'selected' : ''}>${escapeHtml(course.sigla)} - ${escapeHtml(course.nome || '')}</option>`).join('');
    }
    if (activityFilter) {
      activityFilter.innerHTML = '<option value="todos">Todas as atividades</option>' + activities
        .map((activity) => `<option value="${activity.id}" ${activity.id === submissionActivityFilter ? 'selected' : ''}>${escapeHtml(activity.titulo)}</option>`).join('');
    }
    if (statusFilter) statusFilter.value = submissionStatusFilter;
    if (window.SIGACCustomSelect) window.SIGACCustomSelect.refreshAll();

    const visible = submissions.filter((submission) => {
      const text = normalize(`${submission.student?.nome || ''} ${submission.student?.email || ''} ${submission.activity?.titulo || ''} ${submission.course?.sigla || ''}`);
      const status = submission.latest?.status || 'em_analise';
      const matchesSearch = !submissionStudentSearchTerm || text.includes(normalize(submissionStudentSearchTerm));
      const matchesCourse = submissionCourseFilter === 'todos' || submission.course?.id === submissionCourseFilter;
      const matchesActivity = submissionActivityFilter === 'todos' || submission.activity?.id === submissionActivityFilter;
      const matchesStatus = submissionStatusFilter === 'todos' || status === submissionStatusFilter;
      return matchesSearch && matchesCourse && matchesActivity && matchesStatus;
    });

    document.getElementById('submissionFilterResult').textContent = `${visible.length} de ${submissions.length} envios exibidos`;

    container.innerHTML = visible.length
      ? visible.map((submission) => `
          <article class="coordinator-submission-card item accent-card ${submission.latest?.status === 'aprovado' ? 'accent-card--green' : submission.latest?.status === 'rejeitado' ? 'accent-card--danger' : 'accent-card--warning'}">
            <div class="coordinator-submission-top">
              <div>
                <h4>${escapeHtml(submission.student?.nome || 'Aluno')}</h4>
                <p>${escapeHtml(submission.student?.email || 'Sem e-mail')}</p>
              </div>
              <span class="badge ${submission.latest?.status || 'em_analise'}">${escapeHtml((submission.latest?.status || 'em_analise').replace('_', ' '))}</span>
            </div>
            <div class="coordinator-submission-meta">
              <div class="coordinator-submission-meta-card accent-card accent-card--info">
                <span>Atividade</span>
                <strong>${escapeHtml(submission.activity?.titulo || '-')}</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card">
                <span>Curso</span>
                <strong>${escapeHtml(submission.course?.sigla || '-')}</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card accent-card--warning">
                <span>Horas declaradas</span>
                <strong>${Number(submission.latest?.horasDeclaradas || submission.activity?.horas || 0)}h</strong>
              </div>
              <div class="coordinator-submission-meta-card accent-card accent-card--info">
                <span>Data do envio</span>
                <strong>${formatDate(submission.latest?.enviadaEm)}</strong>
              </div>
            </div>
            ${submission.latest?.observacao ? `<p class="coordinator-submission-note"><strong>Observação do aluno:</strong> ${escapeHtml(submission.latest.observacao)}</p>` : ''}
            ${submission.latest?.status === 'em_analise'
              ? `<form class="evaluation-form coordinator-submission-form" data-submission-id="${submission.id}">
                   <div class="field"><label>Feedback</label><textarea name="feedback" placeholder="Comentário para o aluno"></textarea></div>
                   <div class="actions-row coordinator-submission-actions">
                     <button type="button" class="button secondary submission-file-btn" data-submission-id="${submission.id}">Abrir comprovante</button>
                     <button type="button" class="approve-btn success">Aprovar</button>
                     <button type="button" class="reject-btn danger">Rejeitar</button>
                     <button type="button" class="correction-btn secondary">Solicitar correção</button>
                   </div>
                 </form>`
              : `
                 <div class="actions-row coordinator-submission-actions coordinator-submission-actions-readonly">
                   <button type="button" class="button secondary submission-file-btn" data-submission-id="${submission.id}">Abrir comprovante</button>
                 </div>
                 <p class="small"><strong>Feedback:</strong> ${escapeHtml(submission.latest?.feedback || 'Sem observações.')}</p>
               `}
          </article>
        `).join('')
      : '<div class="coordinator-submission-empty item">Nenhum envio encontrado para os filtros atuais.</div>';

    container.querySelectorAll('.submission-file-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await SIGACStore.openCoordinatorSubmissionFile(button.dataset.submissionId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

    container.querySelectorAll('.evaluation-form').forEach((form) => {
      const feedback = () => form.querySelector('textarea').value;
      form.querySelector('.approve-btn').addEventListener('click', async () => {
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'aprovado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
      form.querySelector('.reject-btn').addEventListener('click', async () => {
        try {
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
      form.querySelector('.correction-btn').addEventListener('click', async () => {
        try {
          const textarea = form.querySelector('textarea');
          if (textarea && !textarea.value.trim()) {
            textarea.value = 'Solicitar correção: ajuste o comprovante e envie uma nova versao.';
          }
          await SIGACStore.evaluateSubmission(user.id, form.dataset.submissionId, 'rejeitado', feedback());
          renderCoordinatorSummary(SIGACStore.getCurrentUser());
          renderSubmissions(SIGACStore.getCurrentUser());
        } catch (error) {
          alert(error.message);
        }
      });
    });
    logPerf('renderSubmissions', startedAt);
  }

  function setupSubmissionControls() {
    const refresh = () => renderSubmissions(SIGACStore.getCurrentUser());
    document.getElementById('submissionStudentSearchInput')?.addEventListener('input', (event) => {
      submissionStudentSearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('submissionCourseFilter')?.addEventListener('change', (event) => {
      submissionCourseFilter = event.target.value;
      refresh();
    });
    document.getElementById('submissionActivityFilter')?.addEventListener('change', (event) => {
      submissionActivityFilter = event.target.value;
      refresh();
    });
    document.getElementById('submissionStatusFilter')?.addEventListener('change', (event) => {
      submissionStatusFilter = event.target.value;
      refresh();
    });
  }

  function setupActivityControls() {
    const refresh = () => renderActivities(SIGACStore.getCurrentUser());
    document.getElementById('coordinatorActivitySearchInput')?.addEventListener('input', (event) => {
      coordinatorActivitySearchTerm = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorActivityCourseFilter')?.addEventListener('change', (event) => {
      coordinatorActivityCourseFilter = event.target.value;
      refresh();
    });
    document.getElementById('coordinatorActivityStatusFilter')?.addEventListener('change', (event) => {
      coordinatorActivityStatusFilter = event.target.value;
      refresh();
    });
  }

  function renderCoordinatorSummary(user) {
    renderDashboard(user);
  }

  function renderCoordinatorSection(sectionId, user) {
    if (sectionId === 'dashboard') return renderDashboard(user);
    if (sectionId === 'alunos') return renderStudentsPanel(user);
    if (sectionId === 'atividades') return renderActivities(user);
    if (sectionId === 'regras') return renderRules(user);
    if (sectionId === 'envios') return renderSubmissions(user);
    if (sectionId === 'certificados') {
      renderCertificates(user);
      renderStudentCertificates(user);
      return;
    }
    if (sectionId === 'oportunidades') return renderOpportunities(user);
  }

  function renderCoordinatorCurrentSection(user) {
    renderCoordinatorSection(getCurrentSectionId(), user);
  }

  function renderAll(user) {
    const startedAt = performance.now();
    renderDashboard(user);
    renderStudentsPanel(user);
    renderActivities(user);
    renderRules(user);
    renderSubmissions(user);
    renderCertificates(user);
    renderStudentCertificates(user);
    renderOpportunities(user);
    decorateCoordinatorAccents();
    logPerf('renderAll', startedAt);
  }

  async function init() {
    const startedAt = performance.now();
    try {
      const user = await SIGACStore.bootstrap('coordenador');
      setUserIdentity(user, 'Coordenador');
      populateCourseSelects(user);
      setupStudentForm(user);
      setupStudentPanelControls();
      setupActivityForm(user);
      setupActivityControls();
      setupRuleForm(user);
      setupSubmissionControls();
      setupCertificateReviewControls();
      setupOpportunityControls();
      setupCertificateForm(user);
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
      renderCoordinatorSummary(user);
      renderCoordinatorSection('dashboard', user);
      decorateCoordinatorAccents();
      logPerf('initCoordenador', startedAt);
    } catch (_) {
      window.location.href = 'loginsigac.html';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
