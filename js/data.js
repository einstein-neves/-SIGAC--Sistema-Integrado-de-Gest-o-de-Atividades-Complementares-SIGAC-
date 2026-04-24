(function () {
  'use strict';

  const DATA_KEY = 'sigac_demo_data_v3';
  const SESSION_KEY = 'sigac_demo_session_v3';

  const encodePassword = (value) => btoa(unescape(encodeURIComponent(String(value || ''))));
  const decodePassword = (value) => {
    try {
      return decodeURIComponent(escape(atob(String(value || ''))));
    } catch (_) {
      return '';
    }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const textDataUrl = (text) => `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`;


  function normalizeData(data) {
    if (!data || typeof data !== 'object') data = {};
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    data.settings.horasMetaPadrao = Number(data.settings.horasMetaPadrao || 120);
    data.settings.emailNotificationsEnabled = data.settings.emailNotificationsEnabled !== false;
    data.settings.ocrDisponivel = data.settings.ocrDisponivel !== false;
    data.settings.updatedAt = data.settings.updatedAt || nowIso();

    ['courses', 'users', 'opportunities', 'activities', 'submissions', 'notifications', 'emails', 'certificates'].forEach((key) => {
      if (!Array.isArray(data[key])) data[key] = [];
    });

    data.certificates = data.certificates.map((certificate) => ({
      id: certificate.id || uid('cert'),
      senderId: certificate.senderId || '',
      senderType: certificate.senderType || 'aluno',
      fileName: certificate.fileName || certificate.arquivoNome || 'certificado.txt',
      fileData: certificate.fileData || certificate.arquivoData || '',
      observation: certificate.observation || certificate.observacao || '',
      declaredHours: Number(certificate.declaredHours || 0) || 0,
      extractedText: String(certificate.extractedText || ''),
      detectedHours: Number(certificate.detectedHours || 0) || 0,
      detectedName: String(certificate.detectedName || ''),
      detectedInstitution: String(certificate.detectedInstitution || ''),
      detectedDate: String(certificate.detectedDate || ''),
      detectedTitle: String(certificate.detectedTitle || ''),
      detectedCourseName: String(certificate.detectedCourseName || ''),
      foundFields: Array.isArray(certificate.foundFields) ? certificate.foundFields.filter(Boolean) : [],
      missingFields: Array.isArray(certificate.missingFields) ? certificate.missingFields.filter(Boolean) : [],
      confidenceScore: Number(certificate.confidenceScore || 0) || 0,
      humanSummary: String(certificate.humanSummary || ''),
      ocrStatus: certificate.ocrStatus || 'nao_processado',
      ocrReason: certificate.ocrReason || 'Aguardando análise do admin.',
      adminStatus: certificate.adminStatus || 'pendente',
      adminFeedback: certificate.adminFeedback || '',
      approvedHours: Number(certificate.approvedHours || 0) || 0,
      createdAt: certificate.createdAt || nowIso(),
      reviewedAt: certificate.reviewedAt || '',
      reviewedBy: certificate.reviewedBy || '',
      ocrProcessedAt: certificate.ocrProcessedAt || '',
      senderSnapshot: certificate.senderSnapshot || null
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return data;
  }

  function deriveCertificateSender(data, certificate) {
    const sender = getUserById(data, certificate.senderId);
    return sender ? clone(sender) : clone(certificate.senderSnapshot || null);
  }

  function approvedCertificateHoursInternal(data, studentId) {
    return data.certificates.reduce((total, certificate) => {
      if (certificate.senderId !== studentId || certificate.senderType !== 'aluno' || certificate.adminStatus !== 'aprovado') return total;
      return total + Number(certificate.approvedHours || certificate.detectedHours || certificate.declaredHours || 0);
    }, 0);
  }

  function defaultData() {
    const ads = 'course_ads';
    const log = 'course_log';
    const rh = 'course_rh';

    const adminId = 'user_admin';
    const coordAds = 'user_coord_ads';
    const coordLog = 'user_coord_log';
    const alunoAds = 'user_aluno_ads';
    const alunoAds2 = 'user_aluno_ads_2';
    const alunoLog = 'user_aluno_log';

    const activity1 = 'activity_ads_1';
    const activity2 = 'activity_log_1';

    const seed = {
      settings: {
        horasMetaPadrao: 120,
        emailNotificationsEnabled: true,
        ocrDisponivel: true,
        updatedAt: nowIso()
      },
      courses: [
        { id: ads, sigla: 'ADS', nome: 'Análise e Desenvolvimento de Sistemas', area: 'Tecnologia', turno: 'Noite', horasMeta: 120 },
        { id: log, sigla: 'LOG', nome: 'Logística', area: 'Gestão', turno: 'Tarde', horasMeta: 100 },
        { id: rh, sigla: 'RH', nome: 'Recursos Humanos', area: 'Gestão', turno: 'Noite', horasMeta: 90 }
      ],
      users: [
        { id: adminId, nome: 'Einstein', email: 'einstein@sigac.com', senha: encodePassword('123456789'), tipo: 'superadmin', ativo: true, courseId: '', courseIds: [], criadoEm: nowIso() },
        { id: coordAds, nome: 'Marina Costa', email: 'coord.ads@sigac.com', senha: encodePassword('123456'), tipo: 'coordenador', ativo: true, courseId: '', courseIds: [ads], criadoEm: nowIso() },
        { id: coordLog, nome: 'Paulo Nobre', email: 'coord.log@sigac.com', senha: encodePassword('123456'), tipo: 'coordenador', ativo: true, courseId: '', courseIds: [log], criadoEm: nowIso() },
        { id: alunoAds, nome: 'Ana Clara', email: 'aluno.ads@sigac.com', senha: encodePassword('123456'), tipo: 'aluno', ativo: true, courseId: ads, courseIds: [], criadoEm: nowIso() },
        { id: alunoAds2, nome: 'João Pedro', email: 'aluno.ads2@sigac.com', senha: encodePassword('123456'), tipo: 'aluno', ativo: true, courseId: ads, courseIds: [], criadoEm: nowIso() },
        { id: alunoLog, nome: 'Lívia Souza', email: 'aluno.log@sigac.com', senha: encodePassword('123456'), tipo: 'aluno', ativo: true, courseId: log, courseIds: [], criadoEm: nowIso() }
      ],
      opportunities: [
        { id: 'opp_1', titulo: 'Minicurso de Git e GitHub', descricao: 'Oficina prática com certificado institucional.', horas: 8, inscritos: [alunoAds], criadoPor: adminId, criadoEm: nowIso() },
        { id: 'opp_2', titulo: 'Feira de Empregabilidade SENAC', descricao: 'Participação com horas complementares para alunos e coordenação.', horas: 6, inscritos: [coordAds, alunoLog], criadoPor: adminId, criadoEm: nowIso() }
      ],
      activities: [
        {
          id: activity1,
          titulo: 'Seminário sobre Arquitetura de Software',
          descricao: 'Preparar um resumo crítico e enviar o comprovante de participação.',
          courseId: ads,
          horas: 12,
          prazo: '',
          materialNome: 'roteiro-seminario.txt',
          materialArquivo: textDataUrl('Roteiro do seminário de Arquitetura de Software.\n\n1. Leia o material base.\n2. Participe do encontro.\n3. Envie o comprovante.'),
          createdBy: coordAds,
          createdAt: nowIso()
        },
        {
          id: activity2,
          titulo: 'Relatório de Visita Técnica',
          descricao: 'Enviar relatório da visita técnica com no mínimo duas páginas.',
          courseId: log,
          horas: 10,
          prazo: '',
          materialNome: 'modelo-relatorio.txt',
          materialArquivo: textDataUrl('Modelo de relatório da visita técnica de Logística.'),
          createdBy: coordLog,
          createdAt: nowIso()
        }
      ],
      certificates: [
        {
          id: 'cert_demo_1',
          senderId: alunoAds,
          senderType: 'aluno',
          fileName: 'certificado-git-ana.txt',
          fileData: textDataUrl('Certificado de Participação\nAna Clara\nMinicurso de Git e GitHub\nCarga horária: 8 horas\nSENAC\n15/04/2026'),
          observation: 'Certificado da oficina de Git.',
          declaredHours: 8,
          extractedText: '',
          detectedHours: 0,
          detectedName: '',
          detectedInstitution: '',
          detectedDate: '',
          detectedTitle: '',
          detectedCourseName: '',
          foundFields: [],
          missingFields: [],
          confidenceScore: 0,
          humanSummary: '',
          ocrStatus: 'nao_processado',
          ocrReason: 'Aguardando análise do admin.',
          adminStatus: 'pendente',
          adminFeedback: '',
          approvedHours: 0,
          createdAt: nowIso(),
          reviewedAt: '',
          reviewedBy: '',
          ocrProcessedAt: '',
          senderSnapshot: { nome: 'Ana Clara', email: 'aluno.ads@sigac.com' }
        }
      ],
      submissions: [
        {
          id: 'sub_1',
          activityId: activity1,
          studentId: alunoAds2,
          currentStatus: 'em_analise',
          versions: [
            {
              version: 1,
              arquivoNome: 'comprovante-joao.txt',
              arquivoData: textDataUrl('Comprovante de participação do João Pedro.'),
              observacao: 'Segue meu comprovante.',
              status: 'em_analise',
              feedback: '',
              enviadaEm: nowIso(),
              avaliadaEm: ''
            }
          ]
        }
      ],
      notifications: [],
      emails: []
    };

    seed.notifications.unshift(
      { id: uid('ntf'), userId: alunoAds, mensagem: 'Você já está inscrita no minicurso de Git e GitHub.', tipo: 'info', createdAt: nowIso(), read: false },
      { id: uid('ntf'), userId: coordAds, mensagem: 'Há um envio pendente para análise em ADS.', tipo: 'warning', createdAt: nowIso(), read: false }
    );

    return seed;
  }

  function loadData() {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) {
      const seed = defaultData();
      const normalized = normalizeData(seed);
      localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
      return normalized;
    }
    try {
      const parsed = normalizeData(JSON.parse(raw));
      if (!parsed || typeof parsed !== 'object') throw new Error('Dados inválidos');
      localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
      return parsed;
    } catch (_) {
      const seed = defaultData();
      const normalized = normalizeData(seed);
      localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
      return normalized;
    }
  }

  function saveData(data) {
    const normalized = normalizeData(data);
    localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function mutate(mutator) {
    const data = loadData();
    const result = mutator(data);
    saveData(data);
    return result;
  }

  function getSessionUserId() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function setSessionUserId(userId) {
    localStorage.setItem(SESSION_KEY, userId);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getUserById(data, userId) {
    return data.users.find((user) => user.id === userId) || null;
  }

  function getCourseByIdInternal(data, courseId) {
    return data.courses.find((course) => course.id === courseId) || null;
  }

  function listStudentsForCourseInternal(data, courseId) {
    return data.users.filter((user) => user.tipo === 'aluno' && user.ativo && user.courseId === courseId);
  }

  function addNotificationInternal(data, userId, mensagem, tipo = 'info') {
    data.notifications.unshift({ id: uid('ntf'), userId, mensagem, tipo, createdAt: nowIso(), read: false });
  }

  function queueEmailInternal(data, to, subject, body, kind = 'geral') {
    if (!data.settings.emailNotificationsEnabled) return null;
    const entry = { id: uid('mail'), to, subject, body, kind, status: 'simulado', createdAt: nowIso() };
    data.emails.unshift(entry);
    return entry;
  }

  function getCurrentUser() {
    const data = loadData();
    const userId = getSessionUserId();
    if (!userId) return null;
    return clone(getUserById(data, userId));
  }

  function requireRole(roles) {
    const user = getCurrentUser();
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!user || !allowed.includes(user.tipo)) return null;
    return user;
  }

  function courseTarget(course, data) {
    return Number(course?.horasMeta || data.settings.horasMetaPadrao || 0);
  }

  function getLatestVersion(submission) {
    return submission?.versions?.[submission.versions.length - 1] || null;
  }

  function getStudentProgress(studentId) {
    const data = loadData();
    const student = getUserById(data, studentId);
    if (!student) return { total: 0, target: 0, percent: 0 };

    const approvedHours = data.submissions.reduce((total, submission) => {
      if (submission.studentId !== studentId) return total;
      const latest = getLatestVersion(submission);
      if (!latest || latest.status !== 'aprovado') return total;
      const activity = data.activities.find((item) => item.id === submission.activityId);
      return total + Number(activity?.horas || 0);
    }, 0);

    const opportunityHours = data.opportunities.reduce((total, opportunity) => {
      return opportunity.inscritos?.includes(studentId) ? total + Number(opportunity.horas || 0) : total;
    }, 0);

    const course = getCourseByIdInternal(data, student.courseId);
    const target = courseTarget(course, data);
    const certificateHours = approvedCertificateHoursInternal(data, studentId);
    const total = approvedHours + opportunityHours + certificateHours;
    const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    return { total, target, percent, approvedHours, opportunityHours, certificateHours };
  }

  function listNotificationsForUser(userId) {
    const data = loadData();
    return clone(data.notifications.filter((item) => item.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function markNotificationsAsRead(userId) {
    mutate((data) => {
      data.notifications.forEach((item) => {
        if (item.userId === userId) item.read = true;
      });
    });
  }

  function listActivitiesForCourse(courseId) {
    const data = loadData();
    return clone(data.activities.filter((item) => item.courseId === courseId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function listActivitiesForCoordinator(coordinatorId) {
    const data = loadData();
    return clone(data.activities.filter((item) => item.createdBy === coordinatorId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function listOpportunities() {
    const data = loadData();
    return clone(data.opportunities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function listUsers() {
    return clone(loadData().users);
  }

  function listCourses() {
    return clone(loadData().courses);
  }

  function getCourseById(courseId) {
    return clone(getCourseByIdInternal(loadData(), courseId));
  }

  function getStudentSubmissionForActivity(studentId, activityId) {
    const data = loadData();
    const submission = data.submissions.find((item) => item.studentId === studentId && item.activityId === activityId);
    return submission ? clone(submission) : null;
  }

  function listSubmissionsForStudent(studentId) {
    const data = loadData();
    return clone(data.submissions.filter((item) => item.studentId === studentId));
  }

  function listCoordinatorStudents(coordinatorId) {
    const data = loadData();
    const coordinator = getUserById(data, coordinatorId);
    if (!coordinator) return [];
    return coordinator.courseIds.flatMap((courseId) => {
      const course = getCourseByIdInternal(data, courseId);
      return listStudentsForCourseInternal(data, courseId).map((student) => ({
        ...student,
        course: course ? clone(course) : null,
        progress: getStudentProgress(student.id)
      }));
    });
  }

  function listSubmissionsForCoordinator(coordinatorId) {
    const data = loadData();
    const coordinator = getUserById(data, coordinatorId);
    if (!coordinator) return [];
    const allowedCourses = new Set(coordinator.courseIds || []);

    return clone(
      data.submissions
        .filter((submission) => {
          const activity = data.activities.find((item) => item.id === submission.activityId);
          return activity && allowedCourses.has(activity.courseId);
        })
        .map((submission) => {
          const latest = getLatestVersion(submission);
          const activity = data.activities.find((item) => item.id === submission.activityId);
          const student = getUserById(data, submission.studentId);
          const course = getCourseByIdInternal(data, activity?.courseId);
          return {
            ...submission,
            latest,
            activity,
            student,
            course
          };
        })
        .sort((a, b) => new Date(b.latest?.enviadaEm || 0) - new Date(a.latest?.enviadaEm || 0))
    );
  }


  function listCertificatesForUser(userId) {
    const data = loadData();
    return clone(
      data.certificates
        .filter((certificate) => certificate.senderId === userId)
        .map((certificate) => ({
          ...certificate,
          sender: deriveCertificateSender(data, certificate)
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
  }

  function listCertificatesForAdmin() {
    const data = loadData();
    return clone(
      data.certificates
        .map((certificate) => ({
          ...certificate,
          sender: deriveCertificateSender(data, certificate),
          reviewedByUser: certificate.reviewedBy ? getUserById(data, certificate.reviewedBy) : null
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
  }

  function submitCertificate(senderId, payload) {
    const fileName = String(payload.fileName || '').trim();
    const fileData = String(payload.fileData || '').trim();
    const observation = String(payload.observation || '').trim();
    const declaredHours = Number(payload.declaredHours || 0) || 0;
    if (!fileName || !fileData) throw new Error('Selecione um certificado antes de enviar.');

    return mutate((data) => {
      const sender = getUserById(data, senderId);
      if (!sender || !['aluno', 'coordenador'].includes(sender.tipo)) {
        throw new Error('Somente alunos e coordenadores podem enviar certificados.');
      }

      const certificate = {
        id: uid('cert'),
        senderId: sender.id,
        senderType: sender.tipo,
        fileName,
        fileData,
        observation,
        declaredHours,
        extractedText: '',
        detectedHours: 0,
        detectedName: '',
        detectedInstitution: '',
        detectedDate: '',
        detectedTitle: '',
          detectedCourseName: '',
          foundFields: [],
        missingFields: [],
        confidenceScore: 0,
          humanSummary: '',
          ocrStatus: 'nao_processado',
        ocrReason: 'Aguardando análise do admin.',
        adminStatus: 'pendente',
        adminFeedback: '',
        approvedHours: 0,
        createdAt: nowIso(),
        reviewedAt: '',
        reviewedBy: '',
        ocrProcessedAt: '',
        senderSnapshot: { nome: sender.nome, email: sender.email }
      };

      data.certificates.unshift(certificate);
      data.users
        .filter((user) => user.tipo === 'superadmin' && user.ativo)
        .forEach((admin) => {
          addNotificationInternal(data, admin.id, `${sender.nome} enviou um certificado para validação.`, 'warning');
          queueEmailInternal(data, admin.email, 'SIGAC - novo certificado enviado', `${sender.nome} enviou o certificado ${fileName} para análise.`, 'certificado');
        });
      addNotificationInternal(data, sender.id, 'Seu certificado foi enviado e aguarda análise do administrador.', 'info');
      return clone(certificate);
    });
  }

  function saveCertificateOcrResult(adminId, certificateId, result) {
    return mutate((data) => {
      const admin = getUserById(data, adminId);
      if (!admin || admin.tipo !== 'superadmin') throw new Error('Apenas o admin pode processar OCR.');
      const certificate = data.certificates.find((item) => item.id === certificateId);
      if (!certificate) throw new Error('Certificado não encontrado.');

      certificate.extractedText = String(result.extractedText || '').trim();
      certificate.detectedHours = Number(result.detectedHours || 0) || 0;
      certificate.detectedName = String(result.detectedName || '').trim();
      certificate.detectedInstitution = String(result.detectedInstitution || '').trim();
      certificate.detectedDate = String(result.detectedDate || '').trim();
      certificate.detectedTitle = String(result.detectedTitle || '').trim();
      certificate.detectedCourseName = String(result.detectedCourseName || '').trim();
      certificate.foundFields = Array.isArray(result.foundFields) ? result.foundFields.filter(Boolean) : [];
      certificate.missingFields = Array.isArray(result.missingFields) ? result.missingFields.filter(Boolean) : [];
      certificate.confidenceScore = Number(result.confidenceScore || 0) || 0;
      certificate.humanSummary = String(result.humanSummary || '').trim();
      certificate.ocrStatus = result.ocrStatus || 'analise_manual';
      certificate.ocrReason = String(result.ocrReason || 'Pré-análise concluída.').trim();
      certificate.ocrProcessedAt = nowIso();
      if (certificate.adminStatus === 'pendente' && certificate.ocrStatus === 'aprovado_automatico') {
        certificate.approvedHours = certificate.detectedHours || certificate.declaredHours || 0;
      }
      const sender = deriveCertificateSender(data, certificate);
      if (sender?.id) {
        addNotificationInternal(data, sender.id, `O OCR analisou seu certificado e marcou o status como ${certificate.ocrStatus.replaceAll('_', ' ')}.`, 'info');
      }
      return clone(certificate);
    });
  }

  function reviewCertificate(adminId, certificateId, status, feedback) {
    const finalStatus = status === 'aprovado' ? 'aprovado' : 'rejeitado';
    return mutate((data) => {
      const admin = getUserById(data, adminId);
      if (!admin || admin.tipo !== 'superadmin') throw new Error('Apenas o admin pode revisar certificados.');
      const certificate = data.certificates.find((item) => item.id === certificateId);
      if (!certificate) throw new Error('Certificado não encontrado.');

      certificate.adminStatus = finalStatus;
      certificate.adminFeedback = String(feedback || '').trim();
      certificate.reviewedAt = nowIso();
      certificate.reviewedBy = admin.id;
      certificate.approvedHours = finalStatus === 'aprovado'
        ? Number(certificate.detectedHours || certificate.declaredHours || certificate.approvedHours || 0)
        : 0;

      const sender = deriveCertificateSender(data, certificate);
      const human = finalStatus === 'aprovado' ? 'aprovado' : 'rejeitado';
      if (sender?.id) {
        addNotificationInternal(data, sender.id, `Seu certificado ${certificate.fileName} foi ${human} pelo administrador.`, finalStatus === 'aprovado' ? 'success' : 'warning');
      }
      if (sender?.email) {
        queueEmailInternal(data, sender.email, `SIGAC - certificado ${human}`, `O certificado ${certificate.fileName} foi ${human}. Feedback: ${certificate.adminFeedback || 'Sem observações.'}`, 'certificado-avaliacao');
      }
      return clone(certificate);
    });
  }

  function getAdminDashboardData() {
    const data = loadData();
    const activeUsers = data.users.filter((user) => user.ativo);
    const pending = data.submissions.filter((submission) => getLatestVersion(submission)?.status === 'em_analise').length;
    const approved = data.submissions.filter((submission) => getLatestVersion(submission)?.status === 'aprovado').length;
    const rejected = data.submissions.filter((submission) => getLatestVersion(submission)?.status === 'rejeitado').length;

    const courses = data.courses.map((course) => {
      const students = listStudentsForCourseInternal(data, course.id);
      const courseSubmissions = data.submissions.filter((submission) => {
        const activity = data.activities.find((item) => item.id === submission.activityId);
        return activity?.courseId === course.id;
      });
      const courseApproved = courseSubmissions.filter((submission) => getLatestVersion(submission)?.status === 'aprovado').length;
      const rate = courseSubmissions.length ? Math.round((courseApproved / courseSubmissions.length) * 100) : 0;
      return {
        ...clone(course),
        students: students.map((student) => ({ ...clone(student), progress: getStudentProgress(student.id) })),
        totalAlunos: students.length,
        taxaAprovacao: rate
      };
    });

    return {
      totals: {
        totalCursos: data.courses.length,
        totalUsuarios: activeUsers.length,
        totalOportunidades: data.opportunities.length,
        pendentes: pending,
        aprovados: approved,
        rejeitados: rejected,
        certificadosPendentes: data.certificates.filter((certificate) => certificate.adminStatus === 'pendente').length
      },
      courses,
      users: clone(data.users),
      emails: clone(data.emails),
      settings: clone(data.settings),
      certificates: listCertificatesForAdmin()
    };
  }

  function getCoordinatorDashboardData(coordinatorId) {
    const submissions = listSubmissionsForCoordinator(coordinatorId);
    const students = listCoordinatorStudents(coordinatorId);
    return {
      pendentes: submissions.filter((item) => item.latest?.status === 'em_analise').length,
      aprovados: submissions.filter((item) => item.latest?.status === 'aprovado').length,
      rejeitados: submissions.filter((item) => item.latest?.status === 'rejeitado').length,
      alunosComEnvio: students.filter((student) => listSubmissionsForStudent(student.id).length > 0).length,
      alunosSemEnvio: students.filter((student) => listSubmissionsForStudent(student.id).length === 0).length,
      totalAlunos: students.length,
      totalAtividades: listActivitiesForCoordinator(coordinatorId).length,
      students,
      submissions,
      opportunities: listOpportunities()
    };
  }

  function login(email, senha) {
    const data = loadData();
    const normalized = String(email || '').trim().toLowerCase();
    const user = data.users.find((item) => item.ativo && item.email.toLowerCase() === normalized);
    if (!user || decodePassword(user.senha) !== String(senha || '')) {
      throw new Error('E-mail ou senha incorretos.');
    }
    setSessionUserId(user.id);
    return clone(user);
  }

  function logout() {
    clearSession();
  }

  function resetPassword(email, novaSenha) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !novaSenha) throw new Error('Informe e-mail e nova senha.');

    return mutate((data) => {
      const user = data.users.find((item) => item.email.toLowerCase() === normalized);
      if (!user) throw new Error('E-mail não encontrado.');
      user.senha = encodePassword(novaSenha);
      addNotificationInternal(data, user.id, 'Sua senha foi redefinida com sucesso.', 'info');
      queueEmailInternal(data, user.email, 'SIGAC - senha redefinida', 'Sua senha foi alterada com sucesso no protótipo SIGAC.', 'reset-senha');
      return clone(user);
    });
  }

  function createCourse(payload) {
    const sigla = String(payload.sigla || '').trim().toUpperCase();
    const nome = String(payload.nome || '').trim();
    const area = String(payload.area || '').trim() || 'Geral';
    const turno = String(payload.turno || '').trim() || 'Noite';
    const horasMeta = Number(payload.horasMeta || 0);

    if (!sigla || !nome) throw new Error('Informe sigla e nome do curso.');

    return mutate((data) => {
      if (data.courses.some((course) => course.sigla.toUpperCase() === sigla)) {
        throw new Error('Já existe um curso com esta sigla.');
      }
      const course = { id: uid('course'), sigla, nome, area, turno, horasMeta: horasMeta || data.settings.horasMetaPadrao };
      data.courses.push(course);
      return clone(course);
    });
  }

  function createUser(payload) {
    const nome = String(payload.nome || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const senha = String(payload.senha || '').trim();
    const tipo = String(payload.tipo || '').trim();
    if (!nome || !email || !senha || !['aluno', 'coordenador'].includes(tipo)) {
      throw new Error('Preencha nome, e-mail, senha e tipo corretamente.');
    }

    return mutate((data) => {
      if (data.users.some((user) => user.email.toLowerCase() === email)) {
        throw new Error('Este e-mail já está cadastrado.');
      }
      const user = {
        id: uid('user'),
        nome,
        email,
        senha: encodePassword(senha),
        tipo,
        ativo: true,
        courseId: tipo === 'aluno' ? String(payload.courseId || '') : '',
        courseIds: tipo === 'coordenador' ? clone(payload.courseIds || []) : [],
        criadoEm: nowIso()
      };
      data.users.push(user);
      addNotificationInternal(data, user.id, 'Seu acesso ao SIGAC foi criado.', 'info');
      queueEmailInternal(data, user.email, 'SIGAC - acesso criado', `Olá, ${user.nome}. Seu acesso ao SIGAC foi criado com sucesso.`, 'boas-vindas');
      return clone(user);
    });
  }

  function updateUserStatus(userId, ativo) {
    return mutate((data) => {
      const user = getUserById(data, userId);
      if (!user || user.tipo === 'superadmin') throw new Error('Usuário inválido.');
      user.ativo = Boolean(ativo);
      return clone(user);
    });
  }

  function assignStudentToCourse(studentId, courseId) {
    return mutate((data) => {
      const student = getUserById(data, studentId);
      const course = getCourseByIdInternal(data, courseId);
      if (!student || student.tipo !== 'aluno') throw new Error('Selecione um aluno válido.');
      if (!course) throw new Error('Selecione um curso válido.');
      student.courseId = courseId;
      addNotificationInternal(data, student.id, `Você foi vinculado ao curso ${course.sigla}.`, 'info');
      return clone(student);
    });
  }

  function assignCoordinatorCourses(coordinatorId, courseIds) {
    return mutate((data) => {
      const coordinator = getUserById(data, coordinatorId);
      if (!coordinator || coordinator.tipo !== 'coordenador') throw new Error('Selecione um coordenador válido.');
      coordinator.courseIds = [...new Set((courseIds || []).filter(Boolean))];
      addNotificationInternal(data, coordinator.id, 'Seus vínculos de coordenação foram atualizados.', 'info');
      return clone(coordinator);
    });
  }

  function updateSettings(payload) {
    return mutate((data) => {
      data.settings.horasMetaPadrao = Number(payload.horasMetaPadrao || data.settings.horasMetaPadrao || 120);
      data.settings.emailNotificationsEnabled = Boolean(payload.emailNotificationsEnabled);
      if (payload.ocrDisponivel != null) data.settings.ocrDisponivel = Boolean(payload.ocrDisponivel);
      data.settings.updatedAt = nowIso();
      if (payload.courseTargets && typeof payload.courseTargets === 'object') {
        data.courses.forEach((course) => {
          if (payload.courseTargets[course.id] != null) {
            course.horasMeta = Number(payload.courseTargets[course.id]) || data.settings.horasMetaPadrao;
          }
        });
      }
      return clone(data.settings);
    });
  }

  function createActivity(coordinatorId, payload) {
    const title = String(payload.titulo || '').trim();
    const description = String(payload.descricao || '').trim();
    const courseId = String(payload.courseId || '').trim();
    const horas = Number(payload.horas || 0);
    if (!title || !description || !courseId || !horas) {
      throw new Error('Preencha título, descrição, curso e horas.');
    }

    return mutate((data) => {
      const coordinator = getUserById(data, coordinatorId);
      if (!coordinator || coordinator.tipo !== 'coordenador') throw new Error('Acesso inválido.');
      if (!(coordinator.courseIds || []).includes(courseId)) throw new Error('Você só pode publicar para seus cursos.');
      const activity = {
        id: uid('activity'),
        titulo: title,
        descricao: description,
        courseId,
        horas,
        prazo: String(payload.prazo || '').trim(),
        materialNome: payload.materialNome || '',
        materialArquivo: payload.materialArquivo || '',
        createdBy: coordinatorId,
        createdAt: nowIso()
      };
      data.activities.unshift(activity);
      listStudentsForCourseInternal(data, courseId).forEach((student) => {
        addNotificationInternal(data, student.id, `Nova atividade publicada: ${activity.titulo}.`, 'info');
        queueEmailInternal(data, student.email, 'SIGAC - nova atividade', `Foi publicada uma nova atividade para o seu curso: ${activity.titulo}.`, 'atividade');
      });
      return clone(activity);
    });
  }

  function createOpportunity(adminId, payload) {
    const title = String(payload.titulo || '').trim();
    const description = String(payload.descricao || '').trim();
    const horas = Number(payload.horas || 0);
    if (!title || !description || !horas) throw new Error('Preencha título, descrição e horas da oportunidade.');
    return mutate((data) => {
      const admin = getUserById(data, adminId);
      if (!admin || admin.tipo !== 'superadmin') throw new Error('Acesso inválido.');
      const opportunity = { id: uid('opp'), titulo: title, descricao: description, horas, inscritos: [], criadoPor: adminId, criadoEm: nowIso() };
      data.opportunities.unshift(opportunity);
      return clone(opportunity);
    });
  }

  function toggleOpportunity(userId, opportunityId) {
    return mutate((data) => {
      const opportunity = data.opportunities.find((item) => item.id === opportunityId);
      const user = getUserById(data, userId);
      if (!opportunity || !user) throw new Error('Oportunidade ou usuário inválido.');
      const list = new Set(opportunity.inscritos || []);
      let message = '';
      if (list.has(userId)) {
        list.delete(userId);
        message = `Você saiu da oportunidade ${opportunity.titulo}.`;
      } else {
        list.add(userId);
        message = `Você se inscreveu na oportunidade ${opportunity.titulo}.`;
      }
      opportunity.inscritos = [...list];
      addNotificationInternal(data, userId, message, 'info');
      return clone(opportunity);
    });
  }

  function submitActivityProof(studentId, payload) {
    const activityId = String(payload.activityId || '').trim();
    const fileName = String(payload.arquivoNome || '').trim();
    const fileData = String(payload.arquivoData || '').trim();
    const observation = String(payload.observacao || '').trim();
    if (!activityId || !fileName || !fileData) throw new Error('Selecione um arquivo antes de enviar.');

    return mutate((data) => {
      const student = getUserById(data, studentId);
      const activity = data.activities.find((item) => item.id === activityId);
      if (!student || student.tipo !== 'aluno') throw new Error('Aluno inválido.');
      if (!activity || activity.courseId !== student.courseId) throw new Error('Atividade inválida para este aluno.');

      let submission = data.submissions.find((item) => item.studentId === studentId && item.activityId === activityId);
      const lastVersion = getLatestVersion(submission);
      if (lastVersion && lastVersion.status === 'em_analise') {
        throw new Error('Seu último envio ainda está em análise.');
      }
      if (lastVersion && lastVersion.status === 'aprovado') {
        throw new Error('Esta atividade já foi aprovada.');
      }

      const version = {
        version: lastVersion ? lastVersion.version + 1 : 1,
        arquivoNome: fileName,
        arquivoData: fileData,
        observacao: observation,
        status: 'em_analise',
        feedback: '',
        enviadaEm: nowIso(),
        avaliadaEm: ''
      };

      if (!submission) {
        submission = { id: uid('sub'), activityId, studentId, currentStatus: 'em_analise', versions: [version] };
        data.submissions.unshift(submission);
      } else {
        submission.versions.push(version);
        submission.currentStatus = 'em_analise';
      }

      data.users
        .filter((user) => user.tipo === 'coordenador' && (user.courseIds || []).includes(activity.courseId))
        .forEach((coordinator) => {
          addNotificationInternal(data, coordinator.id, `${student.nome} enviou um arquivo para a atividade ${activity.titulo}.`, 'warning');
          queueEmailInternal(data, coordinator.email, 'SIGAC - novo envio para análise', `${student.nome} enviou um novo arquivo na atividade ${activity.titulo}.`, 'envio');
        });

      addNotificationInternal(data, student.id, `Seu arquivo da atividade ${activity.titulo} foi enviado para análise.`, 'info');
      return clone(submission);
    });
  }

  function evaluateSubmission(coordinatorId, submissionId, status, feedback) {
    const normalizedStatus = status === 'aprovado' ? 'aprovado' : 'rejeitado';
    return mutate((data) => {
      const coordinator = getUserById(data, coordinatorId);
      const submission = data.submissions.find((item) => item.id === submissionId);
      if (!coordinator || coordinator.tipo !== 'coordenador' || !submission) throw new Error('Avaliação inválida.');
      const activity = data.activities.find((item) => item.id === submission.activityId);
      if (!activity || !(coordinator.courseIds || []).includes(activity.courseId)) {
        throw new Error('Você não pode avaliar este envio.');
      }
      const latest = getLatestVersion(submission);
      if (!latest || latest.status !== 'em_analise') throw new Error('Este envio não está pendente.');
      latest.status = normalizedStatus;
      latest.feedback = String(feedback || '').trim();
      latest.avaliadaEm = nowIso();
      submission.currentStatus = normalizedStatus;
      const student = getUserById(data, submission.studentId);
      const human = normalizedStatus === 'aprovado' ? 'aprovado' : 'rejeitado';
      addNotificationInternal(data, student.id, `Seu envio da atividade ${activity.titulo} foi ${human}.`, normalizedStatus === 'aprovado' ? 'success' : 'warning');
      queueEmailInternal(data, student.email, `SIGAC - envio ${human}`, `Sua atividade ${activity.titulo} foi ${human}. Feedback: ${latest.feedback || 'Sem observações.'}`, 'avaliacao');
      return clone(submission);
    });
  }

  function exportEmailLog() {
    const data = loadData();
    const lines = data.emails.map((mail) => `${mail.createdAt} | ${mail.to} | ${mail.subject} | ${mail.status}`);
    return textDataUrl(lines.join('\n') || 'Nenhum e-mail simulado foi registrado.');
  }

  function resetDemo() {
    clearSession();
    saveData(defaultData());
  }

  window.SIGACStore = {
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
    createActivity,
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
    _dump: () => clone(loadData())
  };
})();




