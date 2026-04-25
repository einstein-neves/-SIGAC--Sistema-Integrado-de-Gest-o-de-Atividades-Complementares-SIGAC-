(function () {
  'use strict';

  const TOKEN_KEY = 'sigac_auth_token';

  const state = {
    currentUser: null,
    courses: [],
    users: [],
    opportunities: [],
    notifications: [],
    student: {
      course: null,
      progress: { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 },
      submissions: [],
      activities: [],
      certificates: []
    },
    coordinator: {
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
        opportunities: [],
        activities: []
      },
      certificates: []
    },
    admin: {
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
    } catch (_) {
      throw new Error('Nao foi possivel conectar ao servidor. Abra pelo SIGAC em localhost:3000 ou deixe o servidor ligado.');
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
      throw new Error(errorMessage || 'Nao foi possivel concluir a solicitacao.');
    }

    return payload;
  }

  function resetState() {
    state.currentUser = null;
    state.courses = [];
    state.users = [];
    state.opportunities = [];
    state.notifications = [];
    state.student = {
      course: null,
      progress: { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 },
      submissions: [],
      activities: [],
      certificates: []
    };
    state.coordinator = {
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
        opportunities: [],
        activities: []
      },
      certificates: []
    };
    state.admin = {
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
    state.admin.dashboard = dashboard || state.admin.dashboard;
    state.users = clone(dashboard?.users || []);
    state.opportunities = clone(dashboard?.opportunities || []);
    state.courses = (dashboard?.courses || []).map((course) => ({
      id: course.id,
      sigla: course.sigla,
      nome: course.nome,
      area: course.area,
      turno: course.turno,
      horasMeta: course.horasMeta
    }));
  }

  async function refreshAdminData() {
    const data = await requestJson('/api/admin/dashboard');
    state.currentUser = data.user || state.currentUser;
    hydrateAdminDashboard(data.dashboard || {});
    return clone(state.admin.dashboard);
  }

  async function refreshStudentData() {
    const [dashboardData, activitiesData, opportunitiesData, certificatesData, coursesData] = await Promise.all([
      requestJson('/api/student/dashboard'),
      requestJson('/api/student/activities'),
      requestJson('/api/opportunities'),
      requestJson('/api/certificates/mine'),
      requestJson('/api/courses')
    ]);

    state.currentUser = dashboardData.user || state.currentUser;
    state.student.course = dashboardData.course || null;
    state.student.progress = dashboardData.progress || state.student.progress;
    state.student.submissions = dashboardData.submissions || [];
    state.notifications = dashboardData.notifications || [];
    state.student.activities = activitiesData.activities || [];
    state.opportunities = opportunitiesData.opportunities || [];
    state.student.certificates = certificatesData.certificates || [];
    state.courses = coursesData.courses || [];
    return {
      course: clone(state.student.course),
      progress: clone(state.student.progress),
      submissions: clone(state.student.submissions),
      notifications: clone(state.notifications)
    };
  }

  async function refreshCoordinatorData() {
    const [dashboardData, opportunitiesData, certificatesData, coursesData] = await Promise.all([
      requestJson('/api/coordinator/dashboard'),
      requestJson('/api/opportunities'),
      requestJson('/api/certificates/mine'),
      requestJson('/api/courses')
    ]);

    state.currentUser = dashboardData.user || state.currentUser;
    state.coordinator.dashboard = dashboardData.dashboard || state.coordinator.dashboard;
    state.opportunities = opportunitiesData.opportunities || [];
    state.coordinator.certificates = certificatesData.certificates || [];
    state.courses = coursesData.courses || [];
    return clone(state.coordinator.dashboard);
  }

  async function refreshForCurrentRole() {
    if (!state.currentUser?.tipo) return null;
    if (state.currentUser.tipo === 'superadmin') return refreshAdminData();
    if (state.currentUser.tipo === 'coordenador') return refreshCoordinatorData();
    if (state.currentUser.tipo === 'aluno') return refreshStudentData();
    return null;
  }

  async function bootstrap(requiredRole) {
    const data = await requestJson('/api/me');
    state.currentUser = data.user || null;

    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (requiredRole && (!state.currentUser || !allowed.includes(state.currentUser.tipo))) {
      throw new Error('Acesso negado.');
    }

    await refreshForCurrentRole();
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

  async function resetPassword(email, senha) {
    return requestJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
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
  }

  async function updateUserStatus(userId, ativo) {
    await requestJson(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo })
    });
    await refreshAdminData();
  }

  async function assignStudentToCourse(studentId, courseId) {
    await requestJson(`/api/admin/students/${encodeURIComponent(studentId)}/course`, {
      method: 'POST',
      body: JSON.stringify({ courseId })
    });
    await refreshAdminData();
  }

  async function assignCoordinatorCourses(coordinatorId, courseIds) {
    await requestJson(`/api/admin/coordinators/${encodeURIComponent(coordinatorId)}/courses`, {
      method: 'POST',
      body: JSON.stringify({ courseIds })
    });
    await refreshAdminData();
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
    return clone((state.coordinator.dashboard.activities || []).filter((activity) => activity.createdBy === coordinatorId));
  }

  function listSubmissionsForCoordinator() {
    return clone(state.coordinator.dashboard.submissions || []);
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
  }

  async function evaluateSubmission(coordinatorId, submissionId, status, feedback) {
    await requestJson(`/api/coordinator/submissions/${encodeURIComponent(submissionId)}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback })
    });
    await refreshCoordinatorData();
  }

  function listOpportunities() {
    return clone(state.opportunities);
  }

  async function toggleOpportunity(userId, opportunityId) {
    await requestJson(`/api/opportunities/${encodeURIComponent(opportunityId)}/toggle`, {
      method: 'POST'
    });
    await refreshForCurrentRole();
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

  async function submitCertificate(senderId, payload) {
    await requestJson('/api/certificates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshForCurrentRole();
  }

  async function saveCertificateOcrResult(adminId, certificateId, result) {
    await requestJson(`/api/admin/certificates/${encodeURIComponent(certificateId)}/ocr`, {
      method: 'POST',
      body: JSON.stringify(result)
    });
    await refreshAdminData();
  }

  async function reviewCertificate(adminId, certificateId, status, feedback) {
    await requestJson(`/api/admin/certificates/${encodeURIComponent(certificateId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback })
    });
    await refreshAdminData();
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

  function getCoordinatorDashboardData() {
    return clone(state.coordinator.dashboard);
  }

  function exportEmailLog() {
    const token = getToken();
    return `${API_BASE}/api/admin/email-log${token ? `?token=${encodeURIComponent(token)}` : ''}`;
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

  window.SIGACStore = {
    bootstrap,
    login,
    logout,
    getCurrentUser,
    requireRole,
    resetPassword,
    listCourses,
    getCourseById,
    listUsers,
    createUser,
    updateUserStatus,
    assignStudentToCourse,
    assignCoordinatorCourses,
    updateSettings,
    createCourse,
    createActivity: async function createActivity(coordinatorId, payload) {
      await requestJson('/api/coordinator/activities', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshCoordinatorData();
    },
    listActivitiesForCourse,
    listActivitiesForCoordinator,
    listSubmissionsForCoordinator,
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
    submitCertificate,
    saveCertificateOcrResult,
    reviewCertificate,
    getStudentProgress,
    listCoordinatorStudents,
    getAdminDashboardData,
    getCoordinatorDashboardData,
    exportEmailLog,
    resetDemo,
    _dump: () => clone(state)
  };
})();
