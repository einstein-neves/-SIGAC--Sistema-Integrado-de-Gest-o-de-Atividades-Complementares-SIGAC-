(function () {
  'use strict';

  const TOKEN_KEY = 'sigac_auth_token';
  const PERF_LOGS_ENABLED = true;

  const state = {
    currentUser: null,
    courses: [],
    users: [],
    opportunities: [],
    notifications: [],
    student: {
      loadedTabs: {
        dashboard: false,
        activities: false,
        certificates: false,
        opportunities: false
      },
      course: null,
      progress: { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 },
      submissions: [],
      activities: [],
      courses: [],
      certificates: []
    },
    coordinator: {
      loadedTabs: {
        dashboard: false,
        students: false,
        activities: false,
        rules: false,
        submissions: false,
        certificates: false,
        opportunities: false
      },
      dashboard: {
        pendentes: 0,
        aprovados: 0,
        rejeitados: 0,
        alunosComEnvio: 0,
        alunosSemEnvio: 0,
        totalAlunos: 0,
        totalAtividades: 0,
        students: [],
        submissions: [],
        certificatesToReview: [],
        rules: [],
        opportunities: [],
        activities: [],
        settings: {
          horasMetaPadrao: 120,
          emailNotificationsEnabled: true,
          ocrDisponivel: false
        }
      },
      certificates: []
    },
    admin: {
      loadedTabs: {
        dashboard: false,
        users: false,
        courses: false,
        links: false,
        rules: false,
        opportunities: false,
        submissions: false,
        certificates: false,
        reports: false,
        notifications: false,
        logs: false,
        settings: false
      },
      dashboard: {
        totals: {
          totalCursos: 0,
          totalUsuarios: 0,
          totalOportunidades: 0,
          pendentes: 0,
          aprovados: 0,
          rejeitados: 0,
          certificadosPendentes: 0
        },
        courses: [],
        users: [],
        opportunities: [],
        emails: [],
        rules: [],
        auditLogs: [],
        settings: {
          horasMetaPadrao: 120,
          emailNotificationsEnabled: true,
          ocrDisponivel: false
        },
        certificates: []
      }
    }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.rows)) return value.rows;
    return [];
  }

  function extractPagination(value) {
    if (!value || Array.isArray(value)) return null;
    const total = Number(value.total);
    const limit = Number(value.limit);
    const offset = Number(value.offset);
    if ([total, limit, offset].some((item) => Number.isFinite(item))) {
      return {
        total: Number.isFinite(total) ? total : ensureArray(value).length,
        limit: Number.isFinite(limit) ? limit : ensureArray(value).length,
        offset: Number.isFinite(offset) ? offset : 0
      };
    }
    return null;
  }

  function normalizeCoordinatorDashboard(dashboard) {
    const base = dashboard && typeof dashboard === 'object' ? dashboard : {};
    return {
      ...base,
      students: ensureArray(base.students),
      submissions: ensureArray(base.submissions),
      certificatesToReview: ensureArray(base.certificatesToReview),
      rules: ensureArray(base.rules),
      opportunities: ensureArray(base.opportunities),
      activities: ensureArray(base.activities),
      courses: ensureArray(base.courses),
      settings: {
        horasMetaPadrao: Number(base.settings?.horasMetaPadrao || 120),
        emailNotificationsEnabled: base.settings?.emailNotificationsEnabled !== false,
        ocrDisponivel: !!base.settings?.ocrDisponivel
      },
      submissionsPagination: base.submissionsPagination || extractPagination(base.submissions) || null
    };
  }

  function normalizeAdminDashboard(dashboard) {
    const base = dashboard && typeof dashboard === 'object' ? dashboard : {};
    return {
      ...base,
      courses: ensureArray(base.courses),
      users: ensureArray(base.users),
      opportunities: ensureArray(base.opportunities),
      emails: ensureArray(base.emails),
      rules: ensureArray(base.rules),
      auditLogs: ensureArray(base.auditLogs),
      certificates: ensureArray(base.certificates),
      submissions: ensureArray(base.submissions),
      notifications: ensureArray(base.notifications)
    };
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

  const API_BASE = getApiBase();

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function saveToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function logPerf(label, start) {
    if (!PERF_LOGS_ENABLED) return;
    const duration = Math.round(performance.now() - start);
    console.log(`[SIGAC PERF] ${label}: ${duration}ms`);
  }

  function markLoaded(scope, tabs, loaded = true) {
    const target = state[scope]?.loadedTabs;
    if (!target) return;
    const list = Array.isArray(tabs) ? tabs : [tabs];
    list.forEach((tab) => {
      if (tab) target[tab] = loaded;
    });
  }

  function isLoaded(scope, tab) {
    return !!state[scope]?.loadedTabs?.[tab];
  }

  function buildRequestError(message, details = {}) {
    const error = new Error(message);
    Object.assign(error, details);
    return error;
  }

  function traceAdminBootstrap(message, details) {
    if (typeof details === 'undefined') {
      console.log(`[SIGAC Admin] ${message}`);
      return;
    }
    console.log(`[SIGAC Admin] ${message}`, details);
  }

  async function requestJson(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!headers['Content-Type'] && options.body != null) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    } catch (cause) {
      const offlineMessage = navigator.onLine === false
        ? 'Você está offline. O SIGAC manteve a tela aberta, mas os dados serão atualizados quando a conexão voltar.'
        : 'Não foi possível conectar à API do SIGAC. Mantenha o servidor ligado e tente novamente.';
      throw buildRequestError(offlineMessage, {
        status: 0,
        url,
        cause
      });
    }

    if (url === '/api/me' || url.startsWith('/api/admin/')) {
      traceAdminBootstrap(`Status da resposta ${url}`, response.status);
    }

    let payload = {};
    const isJson = String(response.headers.get('content-type') || '').includes('application/json');
    try {
      payload = isJson ? await response.json() : await response.text();
    } catch (_) {
      payload = isJson ? {} : '';
    }

    if (!response.ok) {
      const errorMessage = typeof payload === 'string' ? payload : payload.error;
      if (response.status === 401) {
        clearToken();
        state.currentUser = null;
      }
      throw buildRequestError(errorMessage || 'Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.', {
        status: response.status,
        url,
        payload
      });
    }

    return payload;
  }

  async function requestBlob(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    } catch (_) {
      throw new Error('Nao foi possivel conectar ao servidor.');
    }

    if (!response.ok) {
      let message = 'Nao foi possivel baixar o arquivo.';
      try {
        const isJson = String(response.headers.get('content-type') || '').includes('application/json');
        const payload = isJson ? await response.json() : await response.text();
        message = payload?.error || payload || message;
      } catch (_) {}
      throw new Error(message);
    }

    return response.blob();
  }

  function saveBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function resetState() {
    state.currentUser = null;
    state.courses = [];
    state.users = [];
    state.opportunities = [];
    state.notifications = [];
    state.student = {
      loadedTabs: {
        dashboard: false,
        activities: false,
        certificates: false,
        opportunities: false
      },
      course: null,
      progress: { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 },
      submissions: [],
      activities: [],
      courses: [],
      certificates: []
    };
    state.coordinator = {
      loadedTabs: {
        dashboard: false,
        students: false,
        activities: false,
        rules: false,
        submissions: false,
        certificates: false,
        opportunities: false
      },
      dashboard: {
        pendentes: 0,
        aprovados: 0,
        rejeitados: 0,
        alunosComEnvio: 0,
        alunosSemEnvio: 0,
        totalAlunos: 0,
        totalAtividades: 0,
        students: [],
        submissions: [],
        certificatesToReview: [],
        rules: [],
        opportunities: [],
        activities: [],
        settings: {
          horasMetaPadrao: 120,
          emailNotificationsEnabled: true,
          ocrDisponivel: false
        }
      },
      certificates: []
    };
    state.admin = {
      loadedTabs: {
        dashboard: false,
        users: false,
        courses: false,
        links: false,
        rules: false,
        opportunities: false,
        submissions: false,
        certificates: false,
        reports: false,
        notifications: false,
        logs: false,
        settings: false
      },
      dashboard: {
        totals: {
          totalCursos: 0,
          totalUsuarios: 0,
          totalOportunidades: 0,
          pendentes: 0,
          aprovados: 0,
          rejeitados: 0,
          certificadosPendentes: 0
        },
        courses: [],
        users: [],
        opportunities: [],
        emails: [],
        rules: [],
        auditLogs: [],
        settings: {
          horasMetaPadrao: 120,
          emailNotificationsEnabled: true,
          ocrDisponivel: false
        },
        certificates: []
      }
    };
  }

  function hydrateAdminDashboard(dashboard) {
    const normalizedDashboard = normalizeAdminDashboard(dashboard);
    state.admin.dashboard = normalizedDashboard;
    state.users = clone(normalizedDashboard.users);
    state.opportunities = clone(normalizedDashboard.opportunities);
    state.courses = normalizedDashboard.courses.map((course) => ({
      id: course.id,
      sigla: course.sigla,
      nome: course.nome,
      area: course.area,
      turno: course.turno,
      horasMeta: course.horasMeta
    }));
  }

  function buildAdminCourses(courseRows, users, submissions, opportunities, certificates) {
    const submissionsByCourseId = new Map();
    const approvedHoursByStudentCourse = new Map();

    for (const submission of submissions || []) {
      const courseId = submission.activity?.courseId;
      if (!courseId) continue;
      if (!submissionsByCourseId.has(courseId)) submissionsByCourseId.set(courseId, []);
      submissionsByCourseId.get(courseId).push(submission);

      const latest = submission.latest || (submission.versions || []).slice(-1)[0] || {};
      if (latest.status === 'aprovado') {
        const key = `${submission.studentId}:${courseId}`;
        approvedHoursByStudentCourse.set(key, (approvedHoursByStudentCourse.get(key) || 0) + Number(submission.activity?.horas || 0));
      }
    }

    const opportunityHoursByStudent = new Map();
    for (const opportunity of opportunities || []) {
      for (const studentId of opportunity.inscritos || []) {
        opportunityHoursByStudent.set(studentId, (opportunityHoursByStudent.get(studentId) || 0) + Number(opportunity.horas || 0));
      }
    }

    const certificateHoursByStudent = new Map();
    for (const certificate of certificates || []) {
      if (certificate.senderType !== 'aluno' || certificate.adminStatus !== 'aprovado') continue;
      certificateHoursByStudent.set(certificate.senderId, (certificateHoursByStudent.get(certificate.senderId) || 0) + Number(certificate.approvedHours || 0));
    }

    const studentsByCourse = new Map();
    for (const user of users || []) {
      if (user.tipo !== 'aluno' || !user.ativo) continue;
      for (const courseId of user.courseIds || []) {
        if (!studentsByCourse.has(courseId)) studentsByCourse.set(courseId, []);
        studentsByCourse.get(courseId).push(user);
      }
    }

    return (courseRows || []).map((course) => {
      const students = (studentsByCourse.get(course.id) || []).map((student) => {
        const approvedHours = approvedHoursByStudentCourse.get(`${student.id}:${course.id}`) || 0;
        const opportunityHours = opportunityHoursByStudent.get(student.id) || 0;
        const certificateHours = certificateHoursByStudent.get(student.id) || 0;
        const target = Number(course.horasMeta || 0);
        const total = approvedHours + opportunityHours + certificateHours;
        return {
          ...student,
          progress: {
            total,
            target,
            percent: target ? Math.min(100, Math.round((total / target) * 100)) : 0,
            approvedHours,
            opportunityHours,
            certificateHours
          }
        };
      });

      const courseSubmissions = submissionsByCourseId.get(course.id) || [];
      const courseApproved = courseSubmissions.filter((submission) => {
        const latest = submission.latest || (submission.versions || []).slice(-1)[0] || {};
        return latest.status === 'aprovado';
      }).length;
      const taxaAprovacao = courseSubmissions.length ? Math.round((courseApproved / courseSubmissions.length) * 100) : 0;
      return { ...course, students, totalAlunos: students.length, taxaAprovacao };
    });
  }

  async function refreshAdminData() {
    traceAdminBootstrap('Carregando /api/admin/dashboard');
    const [summaryData, overviewData] = await Promise.all([
      requestJson('/api/admin/dashboard/summary'),
      requestJson('/api/admin/dashboard/overview')
    ]);

    state.currentUser = summaryData.user || overviewData.user || state.currentUser;
    hydrateAdminDashboard({
      ...(summaryData.dashboard || {}),
      ...(overviewData.dashboard || {})
    });
    markLoaded('admin', ['dashboard', 'courses', 'rules', 'opportunities', 'submissions', 'certificates', 'reports', 'settings'], true);
    return clone(state.admin.dashboard);
  }

  async function refreshStudentData() {
    const [dashboardData, activitiesData, opportunitiesData] = await Promise.all([
      requestJson('/api/student/dashboard'),
      requestJson('/api/student/activities'),
      requestJson('/api/opportunities')
    ]);

    state.currentUser = dashboardData.user || state.currentUser;
    state.student.course = dashboardData.course || null;
    state.student.courses = ensureArray(dashboardData.courses);
    state.student.progress = dashboardData.progress || state.student.progress;
    state.student.submissions = ensureArray(dashboardData.submissions);
    state.notifications = ensureArray(dashboardData.notifications);
    state.student.activities = ensureArray(activitiesData.activities);
    state.opportunities = ensureArray(opportunitiesData.opportunities);
    state.courses = ensureArray(dashboardData.courses).length ? ensureArray(dashboardData.courses) : state.courses;
    markLoaded('student', ['dashboard', 'activities', 'opportunities'], true);
    return {
      course: clone(state.student.course),
      courses: clone(state.student.courses),
      progress: clone(state.student.progress),
      submissions: clone(state.student.submissions),
      notifications: clone(state.notifications)
    };
  }

  async function refreshCoordinatorData() {
    const startedAt = performance.now();
    const dashboardData = await requestJson('/api/coordinator/dashboard/summary');

    state.currentUser = dashboardData.user || state.currentUser;
    state.coordinator.dashboard = normalizeCoordinatorDashboard(dashboardData.dashboard || state.coordinator.dashboard);
    const normalizedCourses = ensureArray(dashboardData.courses).length
      ? ensureArray(dashboardData.courses)
      : ensureArray(dashboardData.dashboard?.courses);
    state.courses = normalizedCourses.length ? normalizedCourses : state.courses;
    markLoaded('coordinator', ['dashboard', 'students', 'submissions'], true);
    logPerf('refreshCoordinatorData', startedAt);
    return clone(state.coordinator.dashboard);
  }

  async function refreshForCurrentRole() {
    if (!state.currentUser?.tipo) return null;
    if (state.currentUser.tipo === 'superadmin') return refreshAdminData();
    if (state.currentUser.tipo === 'coordenador') return refreshCoordinatorData();
    if (state.currentUser.tipo === 'aluno') return refreshStudentData();
    return null;
  }

  async function ensureStudentTabData(tab, options = {}) {
    const force = !!options.force;
    if (!force && isLoaded('student', tab)) return;

    if (tab === 'certificates') {
      const certificatesData = await requestJson('/api/certificates/mine');
      state.student.certificates = ensureArray(certificatesData.certificates);
      markLoaded('student', 'certificates', true);
      return;
    }

    if (tab === 'activities') {
      const [activitiesData, opportunitiesData] = await Promise.all([
        requestJson('/api/student/activities'),
        requestJson('/api/opportunities')
      ]);
      state.student.activities = ensureArray(activitiesData.activities);
      state.opportunities = ensureArray(opportunitiesData.opportunities).length
        ? ensureArray(opportunitiesData.opportunities)
        : state.opportunities;
      markLoaded('student', ['activities', 'opportunities'], true);
    }
  }

  async function ensureCoordinatorTabData(tab, options = {}) {
    const force = !!options.force;
    if (!force && isLoaded('coordinator', tab)) return;

    if (tab === 'activities') {
      const activitiesData = await requestJson('/api/coordinator/activities');
      state.coordinator.dashboard.activities = ensureArray(activitiesData.activities);
      markLoaded('coordinator', 'activities', true);
      return;
    }

    if (tab === 'rules') {
      const rulesData = await requestJson('/api/coordinator/rules');
      state.coordinator.dashboard.rules = ensureArray(rulesData.rules);
      markLoaded('coordinator', 'rules', true);
      return;
    }

    if (tab === 'certificates') {
      const certificatesData = await requestJson('/api/coordinator/certificates');
      state.coordinator.dashboard.certificatesToReview = ensureArray(certificatesData.certificates);
      markLoaded('coordinator', 'certificates', true);
      return;
    }

    if (tab === 'opportunities') {
      const opportunitiesData = await requestJson('/api/opportunities');
      state.opportunities = ensureArray(opportunitiesData.opportunities);
      markLoaded('coordinator', 'opportunities', true);
      return;
    }

    if (tab === 'students') {
      const studentsData = await requestJson('/api/coordinator/students');
      state.coordinator.dashboard.students = ensureArray(studentsData.students);
      markLoaded('coordinator', 'students', true);
      return;
    }

    if (tab === 'submissions') {
      const submissionsData = await requestJson('/api/coordinator/submissions');
      state.coordinator.dashboard.submissions = ensureArray(submissionsData.submissions);
      state.coordinator.dashboard.submissionsPagination = submissionsData.submissionsPagination || extractPagination(submissionsData.submissions) || null;
      markLoaded('coordinator', 'submissions', true);
    }
  }

  async function ensureAdminTabData(tab, options = {}) {
    const force = !!options.force;
    if (!force && isLoaded('admin', tab)) return;

    if (tab === 'users' || tab === 'links') {
      const [usersData, coursesData] = await Promise.all([
        requestJson('/api/admin/users'),
        requestJson('/api/courses')
      ]);
      state.users = ensureArray(usersData.users);
      if (!isLoaded('admin', 'dashboard')) {
        state.courses = ensureArray(coursesData.courses);
      }
      markLoaded('admin', ['users', 'links', 'courses'], true);
      return;
    }

    if (tab === 'notifications') {
      const emailsData = await requestJson('/api/admin/emails');
      state.admin.dashboard.emails = ensureArray(emailsData.emails);
      markLoaded('admin', 'notifications', true);
      return;
    }

    if (tab === 'logs') {
      const auditData = await requestJson('/api/admin/audit-logs');
      state.admin.dashboard.auditLogs = ensureArray(auditData.auditLogs);
      markLoaded('admin', 'logs', true);
      return;
    }
  }

  async function bootstrap(requiredRole) {
    const startedAt = performance.now();
    if (requiredRole === 'superadmin') {
      traceAdminBootstrap('Admin bootstrap iniciado');
      traceAdminBootstrap('Token encontrado', !!getToken());
    }
    const data = await requestJson('/api/me');
    state.currentUser = data.user || null;
    if (requiredRole === 'superadmin') {
      traceAdminBootstrap('Usuário atual', state.currentUser);
    }

    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (requiredRole && (!state.currentUser || !allowed.includes(state.currentUser.tipo))) {
      throw new Error('Acesso negado.');
    }

    await refreshForCurrentRole();
    logPerf(`bootstrap:${requiredRole || 'any'}`, startedAt);
    return clone(state.currentUser);
  }

  async function login(email, senha) {
    const payload = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });
    saveToken(payload.token);
    state.currentUser = payload.user || null;
    await refreshForCurrentRole();
    return clone(state.currentUser);
  }

  function logout() {
    const token = getToken();
    clearToken();
    resetState();
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }

  async function requestPasswordReset(email) {
    return requestJson('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async function resetPassword(token, senha) {
    return requestJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, senha })
    });
  }

  function getCurrentUser() {
    return clone(state.currentUser);
  }

  function requireRole(roles) {
    const user = getCurrentUser();
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!user || !allowed.includes(user.tipo)) return null;
    return user;
  }

  function listCourses() {
    return clone(state.courses);
  }

  function getCourseById(courseId) {
    return clone(state.courses.find((course) => course.id === courseId) || null);
  }

  function listUsers() {
    return clone(state.users);
  }

  async function createUser(payload) {
    await requestJson('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshAdminData();
    if (isLoaded('admin', 'users')) await ensureAdminTabData('users', { force: true });
  }

  async function createCoordinatorStudent(payload) {
    await requestJson('/api/coordinator/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshCoordinatorData();
    if (isLoaded('coordinator', 'students')) await ensureCoordinatorTabData('students', { force: true });
  }

  async function updateUserStatus(userId, ativo) {
    await requestJson(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo })
    });
    await refreshAdminData();
    if (isLoaded('admin', 'users')) await ensureAdminTabData('users', { force: true });
  }

  async function assignStudentToCourse(studentId, courseId) {
    await requestJson(`/api/admin/students/${encodeURIComponent(studentId)}/course`, {
      method: 'POST',
      body: JSON.stringify({ courseId })
    });
    await refreshAdminData();
    if (isLoaded('admin', 'links')) await ensureAdminTabData('links', { force: true });
  }

  async function setActiveStudentCourse(courseId) {
    await requestJson('/api/student/active-course', {
      method: 'POST',
      body: JSON.stringify({ courseId })
    });
    await refreshStudentData();
  }

  async function assignCoordinatorCourses(coordinatorId, courseIds) {
    await requestJson(`/api/admin/coordinators/${encodeURIComponent(coordinatorId)}/courses`, {
      method: 'POST',
      body: JSON.stringify({ courseIds })
    });
    await refreshAdminData();
    if (isLoaded('admin', 'links')) await ensureAdminTabData('links', { force: true });
  }

  async function updateSettings(payload) {
    const response = await requestJson('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    await refreshAdminData();
    return response.settings || clone(state.admin.dashboard.settings);
  }

  async function createCourse(payload) {
    await requestJson('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshAdminData();
    markLoaded('admin', ['users', 'links'], false);
  }

  async function createActivityRule(payload) {
    await requestJson('/api/admin/rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshAdminData();
  }

  async function createCoordinatorRule(payload) {
    await requestJson('/api/coordinator/rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshCoordinatorData();
    if (isLoaded('coordinator', 'rules')) await ensureCoordinatorTabData('rules', { force: true });
  }

  async function createOpportunity(adminId, payload) {
    await requestJson('/api/admin/opportunities', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshForCurrentRole();
  }

  function listActivitiesForCourse(courseId) {
    return clone((state.student.activities || []).filter((activity) => activity.courseId === courseId));
  }

  function listActivitiesForCoordinator(coordinatorId) {
    return clone(state.coordinator.dashboard.activities || []);
  }

  function listSubmissionsForCoordinator() {
    return clone(state.coordinator.dashboard.submissions || []);
  }

  function listCoordinatorRules() {
    return clone(state.coordinator.dashboard.rules || []);
  }

  function listSubmissionsForStudent(studentId) {
    return clone((state.student.submissions || []).filter((submission) => submission.studentId === studentId));
  }

  function getStudentSubmissionForActivity(studentId, activityId) {
    return clone((state.student.submissions || []).find((submission) => submission.studentId === studentId && submission.activityId === activityId) || null);
  }

  async function submitActivityProof(studentId, payload) {
    await requestJson('/api/student/submissions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshStudentData();
    if (isLoaded('student', 'activities')) await ensureStudentTabData('activities', { force: true });
  }

  async function evaluateSubmission(coordinatorId, submissionId, status, feedback) {
    await requestJson(`/api/coordinator/submissions/${encodeURIComponent(submissionId)}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback })
    });
    await refreshCoordinatorData();
    if (isLoaded('coordinator', 'submissions')) await ensureCoordinatorTabData('submissions', { force: true });
    if (isLoaded('coordinator', 'students')) await ensureCoordinatorTabData('students', { force: true });
  }

  function listOpportunities() {
    return clone(state.opportunities);
  }

  async function toggleOpportunity(userId, opportunityId) {
    await requestJson(`/api/opportunities/${encodeURIComponent(opportunityId)}/toggle`, {
      method: 'POST'
    });
    await refreshForCurrentRole();
    if (state.currentUser?.tipo === 'coordenador' && isLoaded('coordinator', 'opportunities')) await ensureCoordinatorTabData('opportunities', { force: true });
    if (state.currentUser?.tipo === 'aluno' && isLoaded('student', 'opportunities')) await ensureStudentTabData('activities', { force: true });
  }

  function listNotificationsForUser() {
    return clone(state.notifications);
  }

  async function markNotificationsAsRead() {
    if (!state.currentUser) return;
    await requestJson('/api/notifications/read', { method: 'POST' });
    state.notifications = state.notifications.map((item) => ({ ...item, read: true }));
  }

  function listCertificatesForUser() {
    if (state.currentUser?.tipo === 'coordenador') return clone(state.coordinator.certificates);
    return clone(state.student.certificates);
  }

  function listCertificatesForAdmin() {
    return clone(state.admin.dashboard.certificates || []);
  }

  function listCertificatesForCoordinatorReview() {
    return clone(state.coordinator.dashboard.certificatesToReview || []);
  }

  async function submitCertificate(senderId, payload) {
    await requestJson('/api/certificates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshForCurrentRole();
    if (state.currentUser?.tipo === 'aluno' && isLoaded('student', 'certificates')) await ensureStudentTabData('certificates', { force: true });
  }

  async function saveCertificateOcrResult(adminId, certificateId, result) {
    await requestJson(`/api/admin/certificates/${encodeURIComponent(certificateId)}/ocr`, {
      method: 'POST',
      body: JSON.stringify(result)
    });
    await refreshAdminData();
  }

  async function saveCoordinatorCertificateOcrResult(coordinatorId, certificateId, result) {
    await requestJson(`/api/coordinator/certificates/${encodeURIComponent(certificateId)}/ocr`, {
      method: 'POST',
      body: JSON.stringify(result)
    });
    await refreshCoordinatorData();
    if (isLoaded('coordinator', 'certificates')) await ensureCoordinatorTabData('certificates', { force: true });
  }

  async function reviewCertificate(adminId, certificateId, status, feedback) {
    await requestJson(`/api/admin/certificates/${encodeURIComponent(certificateId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback })
    });
    await refreshAdminData();
  }

  async function reviewCoordinatorCertificate(coordinatorId, certificateId, status, feedback) {
    await requestJson(`/api/coordinator/certificates/${encodeURIComponent(certificateId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback })
    });
    await refreshCoordinatorData();
    if (isLoaded('coordinator', 'certificates')) await ensureCoordinatorTabData('certificates', { force: true });
  }

  async function getAdminCertificateFile(certificateId) {
    return requestJson(`/api/admin/certificates/${encodeURIComponent(certificateId)}/file`);
  }

  async function getCoordinatorCertificateFile(certificateId) {
    return requestJson(`/api/coordinator/certificates/${encodeURIComponent(certificateId)}/data`);
  }

  async function openBlobInTab(blob) {
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      throw new Error('O navegador bloqueou a nova aba. Permita pop-ups para abrir o arquivo.');
    }

    tab.opener = null;
    tab.document.write('<!doctype html><title>Abrindo arquivo...</title><body style="margin:0;background:#111;color:#fff;font-family:system-ui;padding:24px;">Abrindo arquivo...</body>');
    const url = URL.createObjectURL(blob);
    tab.location.replace(url);
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return tab;
  }

  async function downloadAdminCertificateFile(certificateId, fileName) {
    const blob = await requestBlob(`/api/admin/certificates/${encodeURIComponent(certificateId)}/file?download=1`);
    saveBlob(blob, fileName || 'certificado');
  }

  async function openAdminCertificateFile(certificateId) {
    try {
      const blob = await requestBlob(`/api/admin/certificates/${encodeURIComponent(certificateId)}/file?download=1`);
      await openBlobInTab(blob);
    } catch (error) {
      throw error;
    }
  }

  async function openCoordinatorCertificateFile(certificateId) {
    try {
      const blob = await requestBlob(`/api/coordinator/certificates/${encodeURIComponent(certificateId)}/file`);
      await openBlobInTab(blob);
    } catch (error) {
      throw error;
    }
  }

  async function openCertificateFile(certificateId) {
    try {
      const blob = await requestBlob(`/api/certificates/${encodeURIComponent(certificateId)}/file`);
      await openBlobInTab(blob);
    } catch (error) {
      throw error;
    }
  }

  async function openCoordinatorSubmissionFile(submissionId) {
    const blob = await requestBlob(`/api/coordinator/submissions/${encodeURIComponent(submissionId)}/file`);
    await openBlobInTab(blob);
  }

  async function openActivityMaterial(activityId) {
    const blob = await requestBlob(`/api/activities/${encodeURIComponent(activityId)}/material`);
    await openBlobInTab(blob);
  }

  function getStudentProgress(studentId) {
    if (state.currentUser?.tipo === 'aluno' && state.currentUser.id === studentId) {
      return clone(state.student.progress);
    }
    const adminCourse = state.admin.dashboard.courses || [];
    for (const course of adminCourse) {
      const student = (course.students || []).find((item) => item.id === studentId);
      if (student?.progress) return clone(student.progress);
    }
    const coordStudent = (state.coordinator.dashboard.students || []).find((item) => item.id === studentId);
    return clone(coordStudent?.progress || { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 });
  }

  function listCoordinatorStudents() {
    return clone(state.coordinator.dashboard.students || []);
  }

  function getAdminDashboardData() {
    return clone(state.admin.dashboard);
  }

  function listStudentCourses() {
    return clone(state.student.courses || []);
  }

  function getCoordinatorDashboardData() {
    return clone(state.coordinator.dashboard);
  }

  async function exportEmailLog() {
    const blob = await requestBlob('/api/admin/email-log');
    saveBlob(blob, 'sigac-email-log.txt');
  }

  async function resetDemo() {
    const response = await requestJson('/api/admin/reset-demo', { method: 'POST' });
    if (response.token) {
      saveToken(response.token);
      state.currentUser = response.user || null;
      await refreshAdminData();
    } else {
      clearToken();
      resetState();
    }
    return response;
  }

  function mergeChartOptions(base, override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? base;
    const result = Array.isArray(base) ? [...base] : { ...(base || {}) };
    Object.entries(override).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = mergeChartOptions(result[key], value);
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  window.SIGACCharts = {
    ensureDefaults() {
      if (!window.Chart || window.Chart.__sigacDefaultsApplied) return;
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;
      Chart.defaults.color = '#d7dbe1';
      Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
      Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
      Chart.defaults.font.weight = '400';
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
      Chart.defaults.plugins.legend.labels.color = '#f4f5f6';
      Chart.defaults.plugins.tooltip.backgroundColor = '#181a1d';
      Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
      Chart.defaults.plugins.tooltip.bodyColor = '#d7dbe1';
      Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.14)';
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.padding = 12;
      window.Chart.__sigacDefaultsApplied = true;
    },
    mergeOptions(base, override) {
      return mergeChartOptions(base, override);
    },
    createTooltip(overrides = {}) {
      return mergeChartOptions({
        displayColors: true,
        backgroundColor: '#181a1d',
        titleColor: '#ffffff',
        bodyColor: '#dce7d6',
        borderColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        padding: 12
      }, overrides);
    },
    createLegend(overrides = {}) {
      return mergeChartOptions({
        position: 'bottom',
        labels: {
          color: '#f4f5f6',
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12, weight: '500' }
        }
      }, overrides);
    },
    createScale(overrides = {}) {
      return mergeChartOptions({
        border: { display: false },
        grid: {
          color: 'rgba(255,255,255,0.07)',
          drawTicks: false
        },
        ticks: {
          color: '#9ca3af',
          padding: 8,
          font: { size: 12, weight: '500' }
        }
      }, overrides);
    },
    createOptions({ scales = null, plugins = {}, layout = {}, ...rest } = {}) {
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        layout,
        plugins: mergeChartOptions({
          legend: this.createLegend(),
          tooltip: this.createTooltip()
        }, plugins)
      };
      if (scales) options.scales = scales;
      return mergeChartOptions(options, rest);
    }
  };

  window.SIGACStore = {
    bootstrap,
    login,
    logout,
    getCurrentUser,
    requireRole,
    requestPasswordReset,
    resetPassword,
    listCourses,
    getCourseById,
    listUsers,
    createUser,
    createCoordinatorStudent,
    updateUserStatus,
    assignStudentToCourse,
    setActiveStudentCourse,
    assignCoordinatorCourses,
    updateSettings,
    createCourse,
    createActivityRule,
    createCoordinatorRule,
    createActivity: async function createActivity(coordinatorId, payload) {
      await requestJson('/api/coordinator/activities', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshCoordinatorData();
      if (isLoaded('coordinator', 'activities')) await ensureCoordinatorTabData('activities', { force: true });
    },
    listActivitiesForCourse,
    listActivitiesForCoordinator,
    listSubmissionsForCoordinator,
    listCoordinatorRules,
    listSubmissionsForStudent,
    getStudentSubmissionForActivity,
    submitActivityProof,
    evaluateSubmission,
    listOpportunities,
    createOpportunity,
    toggleOpportunity,
    listNotificationsForUser,
    markNotificationsAsRead,
    listCertificatesForUser,
    listCertificatesForAdmin,
    listCertificatesForCoordinatorReview,
    submitCertificate,
    saveCertificateOcrResult,
    saveCoordinatorCertificateOcrResult,
    reviewCertificate,
    reviewCoordinatorCertificate,
    getAdminCertificateFile,
    downloadAdminCertificateFile,
    openAdminCertificateFile,
    getCoordinatorCertificateFile,
    openCoordinatorCertificateFile,
    openCoordinatorSubmissionFile,
    openActivityMaterial,
    openCertificateFile,
    getStudentProgress,
    listCoordinatorStudents,
    getAdminDashboardData,
    listStudentCourses,
    getCoordinatorDashboardData,
    ensureStudentTabData,
    ensureCoordinatorTabData,
    ensureAdminTabData,
    exportEmailLog,
    resetDemo,
    _dump: () => clone(state)
  };
})();
