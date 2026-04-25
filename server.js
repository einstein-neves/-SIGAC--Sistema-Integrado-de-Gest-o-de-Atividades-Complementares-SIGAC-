const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { db, initDatabase, transaction } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const textDataUrl = (text) => `data:text/plain;base64,${Buffer.from(String(text || ''), 'utf8').toString('base64')}`;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

async function seedIfEmpty() {
  const countRow = await db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (Number(countRow?.total || 0) > 0) return;

  const ads = 'course_ads';
  const log = 'course_log';
  const rh = 'course_rh';

  const adminId = 'user_admin';
  const coordAds = 'user_coord_ads';
  const coordLog = 'user_coord_log';
  const alunoAds = 'user_aluno_ads';
  const alunoAds2 = 'user_aluno_ads_2';
  const alunoLog = 'user_aluno_log';

  await transaction(async (tx) => {
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('horasMetaPadrao', '120');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('emailNotificationsEnabled', 'true');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('ocrDisponivel', 'false');
    await tx.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('updatedAt', nowIso());

    const insertCourse = tx.prepare('INSERT INTO courses (id, sigla, nome, area, turno, horas_meta) VALUES (?, ?, ?, ?, ?, ?)');
    await insertCourse.run(ads, 'ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnologia', 'Noite', 120);
    await insertCourse.run(log, 'LOG', 'Logística', 'Gestão', 'Tarde', 100);
    await insertCourse.run(rh, 'RH', 'Recursos Humanos', 'Gestão', 'Noite', 90);

    const insertUser = tx.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await insertUser.run(adminId, 'Einstein', 'einstein@sigac.com', hashPassword('123456789'), 'superadmin', 1, null, nowIso());
    await insertUser.run(coordAds, 'Marina Costa', 'coord.ads@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
    await insertUser.run(coordLog, 'Paulo Nobre', 'coord.log@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
    await insertUser.run(alunoAds, 'Ana Clara', 'aluno.ads@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
    await insertUser.run(alunoAds2, 'João Pedro', 'aluno.ads2@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
    await insertUser.run(alunoLog, 'Lívia Souza', 'aluno.log@sigac.com', hashPassword('123456'), 'aluno', 1, log, nowIso());

    const insertCoordCourse = tx.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
    await insertCoordCourse.run(coordAds, ads);
    await insertCoordCourse.run(coordLog, log);

    const insertOpp = tx.prepare('INSERT INTO opportunities (id, titulo, descricao, horas, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)');
    await insertOpp.run('opp_1', 'Minicurso de Git e GitHub', 'Oficina prática com certificado institucional.', 8, adminId, nowIso());
    await insertOpp.run('opp_2', 'Feira de Empregabilidade SENAC', 'Participação com horas complementares para alunos e coordenação.', 6, adminId, nowIso());
    await tx.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_1', alunoAds);
    await tx.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_2', coordAds);
    await tx.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_2', alunoLog);

    const insertActivity = tx.prepare('INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await insertActivity.run('activity_ads_1', 'Seminário sobre Arquitetura de Software', 'Preparar um resumo crítico e enviar o comprovante de participação.', ads, 12, '', 'roteiro-seminario.txt', textDataUrl('Roteiro do seminário de Arquitetura de Software.\n\n1. Leia o material base.\n2. Participe do encontro.\n3. Envie o comprovante.'), coordAds, nowIso());
    await insertActivity.run('activity_log_1', 'Relatório de Visita Técnica', 'Enviar relatório da visita técnica com no mínimo duas páginas.', log, 10, '', 'modelo-relatorio.txt', textDataUrl('Modelo de relatório da visita técnica de Logística.'), coordLog, nowIso());

    await tx.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run('sub_1', 'activity_ads_1', alunoAds2, 'em_analise');
    await tx.prepare(`INSERT INTO submission_versions (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('sub_1', 1, 'comprovante-joao.txt', textDataUrl('Comprovante de participação do João Pedro.'), 'Segue meu comprovante.', 'em_analise', '', nowIso(), '');
  });

  await addNotification(alunoAds, 'Você já está inscrita no minicurso de Git e GitHub.', 'info');
  await addNotification(coordAds, 'Há um envio pendente para análise em ADS.', 'warning');
}

async function getSetting(key, fallback = '') {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`).run(key, String(value));
}

async function addNotification(userId, mensagem, tipo = 'info') {
  await db.prepare('INSERT INTO notifications (id, user_id, mensagem, tipo, created_at, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(uid('ntf'), userId, mensagem, tipo, nowIso());
}

async function queueEmail(to, subject, body, kind = 'geral') {
  if (await getSetting('emailNotificationsEnabled', 'true') !== 'true') return null;
  const email = { id: uid('mail'), to, subject, body, kind, status: 'simulado', createdAt: nowIso() };
  await db.prepare('INSERT INTO emails (id, to_email, subject, body, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(email.id, email.to, email.subject, email.body, email.kind, email.status, email.createdAt);
  return email;
}

async function getCoordinatorCourseIds(userId) {
  const rows = await db.prepare('SELECT course_id FROM coordinator_courses WHERE user_id = ? ORDER BY course_id').all(userId);
  return rows.map((row) => row.course_id);
}

async function serializeUser(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    tipo: row.tipo,
    ativo: !!row.ativo,
    courseId: row.course_id || '',
    courseIds: row.tipo === 'coordenador' ? await getCoordinatorCourseIds(row.id) : [],
    createdAt: row.created_at
  };
}

async function getUserById(userId) {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return row ? serializeUser(row) : null;
}

async function getCourseById(courseId) {
  const row = await db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!row) return null;
  return {
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    area: row.area,
    turno: row.turno,
    horasMeta: Number(row.horas_meta || 0)
  };
}

async function listCourses() {
  const rows = await db.prepare('SELECT * FROM courses ORDER BY sigla').all();
  return rows.map((row) => ({
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    area: row.area,
    turno: row.turno,
    horasMeta: Number(row.horas_meta || 0)
  }));
}

async function listUsers() {
  const rows = await db.prepare('SELECT * FROM users ORDER BY nome').all();
  const result = [];
  for (const row of rows) result.push(await serializeUser(row));
  return result;
}

async function listOpportunities() {
  const opportunities = await db.prepare('SELECT * FROM opportunities ORDER BY criado_em DESC').all();
  const regStmt = db.prepare('SELECT user_id FROM opportunity_registrations WHERE opportunity_id = ? ORDER BY user_id');
  const result = [];
  for (const row of opportunities) {
    const regRows = await regStmt.all(row.id);
    result.push({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      horas: Number(row.horas || 0),
      criadoPor: row.criado_por,
      criadoEm: row.criado_em,
      inscritos: regRows.map((item) => item.user_id)
    });
  }
  return result;
}

function serializeActivity(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    courseId: row.course_id,
    horas: Number(row.horas || 0),
    prazo: row.prazo || '',
    materialNome: row.material_nome || '',
    materialArquivo: row.material_arquivo || '',
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

async function getActivityById(id) {
  const row = await db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  return row ? serializeActivity(row) : null;
}

async function listActivitiesForCourse(courseId) {
  const rows = await db.prepare('SELECT * FROM activities WHERE course_id = ? ORDER BY created_at DESC').all(courseId);
  return rows.map(serializeActivity);
}

async function listActivitiesForCoordinator(coordinatorId) {
  const rows = await db.prepare('SELECT * FROM activities WHERE created_by = ? ORDER BY created_at DESC').all(coordinatorId);
  return rows.map(serializeActivity);
}

async function getSubmissionVersions(submissionId) {
  const rows = await db.prepare('SELECT * FROM submission_versions WHERE submission_id = ? ORDER BY version ASC').all(submissionId);
  return rows.map((row) => ({
    id: Number(row.id),
    version: Number(row.version),
    arquivoNome: row.arquivo_nome,
    arquivoData: row.arquivo_data,
    observacao: row.observacao || '',
    status: row.status,
    feedback: row.feedback || '',
    enviadaEm: row.enviada_em,
    avaliadaEm: row.avaliada_em || ''
  }));
}

async function serializeSubmission(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    studentId: row.student_id,
    currentStatus: row.current_status,
    versions: await getSubmissionVersions(row.id)
  };
}

async function getSubmissionById(id) {
  const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  return row ? serializeSubmission(row) : null;
}

async function getStudentSubmissionForActivity(studentId, activityId) {
  const row = await db.prepare('SELECT * FROM submissions WHERE student_id = ? AND activity_id = ?').get(studentId, activityId);
  return row ? serializeSubmission(row) : null;
}

async function listSubmissionsForStudent(studentId) {
  const rows = await db.prepare('SELECT * FROM submissions WHERE student_id = ? ORDER BY id DESC').all(studentId);
  const result = [];
  for (const row of rows) result.push(await serializeSubmission(row));
  return result;
}

function getLatestVersion(submission) {
  return submission?.versions?.[submission.versions.length - 1] || null;
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

async function serializeCertificate(row) {
  const sender = await getUserById(row.sender_id);
  const reviewedByUser = row.reviewed_by ? await getUserById(row.reviewed_by) : null;
  return {
    id: row.id,
    senderId: row.sender_id,
    senderType: row.sender_type,
    fileName: row.file_name,
    fileData: row.file_data,
    observation: row.observation || '',
    declaredHours: Number(row.declared_hours || 0),
    extractedText: row.extracted_text || '',
    detectedHours: Number(row.detected_hours || 0),
    detectedName: row.detected_name || '',
    detectedInstitution: row.detected_institution || '',
    detectedDate: row.detected_date || '',
    detectedTitle: row.detected_title || '',
    detectedCourseName: row.detected_course_name || '',
    foundFields: parseJsonList(row.found_fields),
    missingFields: parseJsonList(row.missing_fields),
    confidenceScore: Number(row.confidence_score || 0),
    humanSummary: row.human_summary || '',
    ocrStatus: row.ocr_status || 'nao_processado',
    ocrReason: row.ocr_reason || 'Aguardando análise do admin.',
    adminStatus: row.admin_status || 'pendente',
    adminFeedback: row.admin_feedback || '',
    approvedHours: Number(row.approved_hours || 0),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || '',
    reviewedBy: row.reviewed_by || '',
    ocrProcessedAt: row.ocr_processed_at || '',
    sender,
    reviewedByUser
  };
}

async function getCertificateById(certificateId) {
  const row = await db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateId);
  return row ? serializeCertificate(row) : null;
}

async function listCertificatesForUser(userId) {
  const rows = await db.prepare('SELECT * FROM certificates WHERE sender_id = ? ORDER BY created_at DESC').all(userId);
  const result = [];
  for (const row of rows) result.push(await serializeCertificate(row));
  return result;
}

async function listCertificatesForAdmin() {
  const rows = await db.prepare('SELECT * FROM certificates ORDER BY created_at DESC').all();
  const result = [];
  for (const row of rows) result.push(await serializeCertificate(row));
  return result;
}

async function getApprovedCertificateHours(studentId) {
  const row = await db.prepare(`SELECT COALESCE(SUM(approved_hours), 0) AS total
                                FROM certificates
                                WHERE sender_id = ? AND sender_type = 'aluno' AND admin_status = 'aprovado'`).get(studentId);
  return Number(row?.total || 0);
}

async function getStudentProgress(studentId) {
  const student = await getUserById(studentId);
  if (!student) return { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0, certificateHours: 0 };

  const submissions = await listSubmissionsForStudent(studentId);
  let approvedHours = 0;
  for (const submission of submissions) {
    const latest = getLatestVersion(submission);
    if (!latest || latest.status !== 'aprovado') continue;
    const activity = await getActivityById(submission.activityId);
    approvedHours += Number(activity?.horas || 0);
  }

  const opportunities = await listOpportunities();
  const opportunityHours = opportunities.reduce((sum, item) => item.inscritos.includes(studentId) ? sum + Number(item.horas || 0) : sum, 0);
  const certificateHours = await getApprovedCertificateHours(studentId);
  const course = await getCourseById(student.courseId);
  const target = Number(course?.horasMeta || await getSetting('horasMetaPadrao', '120') || 120);
  const total = approvedHours + opportunityHours + certificateHours;
  const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  return { total, target, percent, approvedHours, opportunityHours, certificateHours };
}

async function listCoordinatorStudents(coordinatorId) {
  const courseIds = await getCoordinatorCourseIds(coordinatorId);
  const stmt = db.prepare('SELECT * FROM users WHERE tipo = ? AND ativo = 1 AND course_id = ? ORDER BY nome');
  const result = [];
  for (const courseId of courseIds) {
    const course = await getCourseById(courseId);
    const rows = await stmt.all('aluno', courseId);
    for (const row of rows) {
      const student = await serializeUser(row);
      result.push({ ...student, course, progress: await getStudentProgress(student.id) });
    }
  }
  return result;
}

async function listSubmissionsForCoordinator(coordinatorId) {
  const courseIds = new Set(await getCoordinatorCourseIds(coordinatorId));
  const rows = await db.prepare('SELECT * FROM submissions').all();
  const result = [];
  for (const row of rows) {
    const submission = await serializeSubmission(row);
    const activity = await getActivityById(submission.activityId);
    if (!activity || !courseIds.has(activity.courseId)) continue;
    const student = await getUserById(submission.studentId);
    const course = await getCourseById(activity.courseId);
    result.push({ ...submission, activity, student, course, latest: getLatestVersion(submission) });
  }
  return result.sort((a, b) => new Date(b.latest?.enviadaEm || 0) - new Date(a.latest?.enviadaEm || 0));
}

async function getNotificationsForUser(userId) {
  const rows = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    mensagem: row.mensagem,
    tipo: row.tipo,
    createdAt: row.created_at,
    read: !!row.read
  }));
}

async function markNotificationsRead(userId) {
  await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

async function getAdminDashboardData() {
  const users = await listUsers();
  const activeUsers = users.filter((item) => item.ativo);

  const submissionRows = await db.prepare('SELECT * FROM submissions').all();
  const submissions = [];
  for (const row of submissionRows) submissions.push(await serializeSubmission(row));

  const pending = submissions.filter((item) => getLatestVersion(item)?.status === 'em_analise').length;
  const approved = submissions.filter((item) => getLatestVersion(item)?.status === 'aprovado').length;
  const rejected = submissions.filter((item) => getLatestVersion(item)?.status === 'rejeitado').length;

  const courses = [];
  for (const course of await listCourses()) {
    const students = [];
    for (const student of users.filter((user) => user.tipo === 'aluno' && user.ativo && user.courseId === course.id)) {
      students.push({ ...student, progress: await getStudentProgress(student.id) });
    }

    const courseSubmissions = [];
    for (const submission of submissions) {
      const activity = await getActivityById(submission.activityId);
      if (activity?.courseId === course.id) courseSubmissions.push(submission);
    }

    const courseApproved = courseSubmissions.filter((item) => getLatestVersion(item)?.status === 'aprovado').length;
    const taxaAprovacao = courseSubmissions.length ? Math.round((courseApproved / courseSubmissions.length) * 100) : 0;
    courses.push({ ...course, students, totalAlunos: students.length, taxaAprovacao });
  }

  const opportunities = await listOpportunities();
  const emailRows = await db.prepare('SELECT * FROM emails ORDER BY created_at DESC').all();
  const certificates = await listCertificatesForAdmin();

  return {
    totals: {
      totalCursos: courses.length,
      totalUsuarios: activeUsers.length,
      totalOportunidades: opportunities.length,
      pendentes: pending,
      aprovados: approved,
      rejeitados: rejected,
      certificadosPendentes: certificates.filter((item) => item.adminStatus === 'pendente').length
    },
    courses,
    users,
    opportunities,
    emails: emailRows.map((row) => ({
      id: row.id,
      to: row.to_email,
      subject: row.subject,
      body: row.body,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at
    })),
    settings: {
      horasMetaPadrao: Number(await getSetting('horasMetaPadrao', '120')),
      emailNotificationsEnabled: await getSetting('emailNotificationsEnabled', 'true') === 'true',
      ocrDisponivel: await getSetting('ocrDisponivel', 'false') === 'true'
    },
    certificates
  };
}

async function getCoordinatorDashboardData(coordinatorId) {
  const submissions = await listSubmissionsForCoordinator(coordinatorId);
  const students = await listCoordinatorStudents(coordinatorId);
  const submissionFlags = await Promise.all(students.map(async (student) => (await listSubmissionsForStudent(student.id)).length > 0));
  const activities = await listActivitiesForCoordinator(coordinatorId);
  return {
    pendentes: submissions.filter((item) => item.latest?.status === 'em_analise').length,
    aprovados: submissions.filter((item) => item.latest?.status === 'aprovado').length,
    rejeitados: submissions.filter((item) => item.latest?.status === 'rejeitado').length,
    alunosComEnvio: submissionFlags.filter(Boolean).length,
    alunosSemEnvio: submissionFlags.filter((flag) => !flag).length,
    totalAlunos: students.length,
    totalAtividades: activities.length,
    students,
    submissions,
    opportunities: await listOpportunities(),
    activities
  };
}

async function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, nowIso());
  return token;
}

async function getSessionUser(token) {
  const row = await db.prepare(`SELECT users.* FROM sessions
                                JOIN users ON users.id = sessions.user_id
                                WHERE sessions.token = ?`).get(token);
  return row ? serializeUser(row) : null;
}

async function deleteSession(token) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const contentType = typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    ...headers
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 15 * 1024 * 1024) {
        reject(new Error('Corpo da requisição muito grande.'));
      }
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function getToken(req, urlObj) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return urlObj.searchParams.get('token') || '';
}

async function requireAuth(req, res, urlObj, roles = null) {
  const token = getToken(req, urlObj);
  const user = token ? await getSessionUser(token) : null;
  if (!user) {
    send(res, 401, { error: 'Sessão inválida ou expirada.' });
    return null;
  }
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user.tipo)) {
      send(res, 403, { error: 'Acesso negado.' });
      return null;
    }
  }
  return { token, user };
}

function notFound(res) {
  send(res, 404, { error: 'Rota não encontrada.' });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  try {
    if (req.method === 'OPTIONS') {
      return send(res, 204, '');
    }

    if (pathname === '/api/public/courses' && req.method === 'GET') {
      return send(res, 200, { courses: await listCourses() });
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      const courseId = String(body.courseId || '').trim();

      if (!nome || !email || !senha || !courseId) {
        return send(res, 400, { error: 'Informe nome, e-mail, senha e curso.' });
      }
      if (senha.length < 6) {
        return send(res, 400, { error: 'A senha deve ter ao menos 6 caracteres.' });
      }

      const course = await getCourseById(courseId);
      if (!course) {
        return send(res, 400, { error: 'Curso invalido.' });
      }

      const exists = await db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
      if (exists) {
        return send(res, 409, { error: 'Este e-mail ja esta cadastrado.' });
      }

      const id = uid('user');
      await db.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, nome, email, hashPassword(senha), 'aluno', course.id, nowIso());

      await addNotification(id, 'Seu acesso ao SIGAC foi criado.', 'info');
      await queueEmail(email, 'SIGAC - acesso criado', `Ola, ${nome}. Seu acesso ao SIGAC foi criado com sucesso.`, 'boas-vindas');

      const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return send(res, 201, { ok: true, user: await serializeUser(row) });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      const row = await db.prepare('SELECT * FROM users WHERE email = ? AND ativo = 1').get(email);
      if (!row || !verifyPassword(senha, row.senha_hash)) {
        return send(res, 401, { error: 'E-mail ou senha incorretos.' });
      }
      const user = await serializeUser(row);
      const token = await createSession(user.id);
      return send(res, 200, { token, user });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getToken(req, urlObj);
      if (token) await deleteSession(token);
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      if (!email || !senha) return send(res, 400, { error: 'Informe e-mail e nova senha.' });
      const row = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!row) return send(res, 404, { error: 'E-mail não encontrado.' });
      await db.prepare('UPDATE users SET senha_hash = ? WHERE id = ?').run(hashPassword(senha), row.id);
      await addNotification(row.id, 'Sua senha foi redefinida com sucesso.', 'info');
      await queueEmail(email, 'SIGAC - senha redefinida', 'Sua senha foi alterada com sucesso no SIGAC.', 'reset-senha');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { user: auth.user });
    }

    if (pathname === '/api/courses' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { courses: await listCourses() });
    }

    if (pathname === '/api/opportunities' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { opportunities: await listOpportunities() });
    }

    if (pathname === '/api/notifications/read' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      await markNotificationsRead(auth.user.id);
      return send(res, 200, { ok: true });
    }

    if (pathname.match(/^\/api\/opportunities\/[^/]+\/toggle$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const opportunityId = pathname.split('/')[3];
      const current = (await listOpportunities()).find((item) => item.id === opportunityId);
      if (!current) return send(res, 404, { error: 'Oportunidade não encontrada.' });
      const exists = await db.prepare('SELECT 1 FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').get(opportunityId, auth.user.id);
      if (exists) {
        await db.prepare('DELETE FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').run(opportunityId, auth.user.id);
        await addNotification(auth.user.id, `Você saiu da oportunidade ${current.titulo}.`, 'info');
      } else {
        await db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run(opportunityId, auth.user.id);
        await addNotification(auth.user.id, `Você se inscreveu na oportunidade ${current.titulo}.`, 'info');
      }
      return send(res, 200, { opportunity: (await listOpportunities()).find((item) => item.id === opportunityId) });
    }

    if (pathname === '/api/student/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const course = await getCourseById(auth.user.courseId);
      const progress = await getStudentProgress(auth.user.id);
      const submissions = await listSubmissionsForStudent(auth.user.id);
      const notifications = await getNotificationsForUser(auth.user.id);
      await markNotificationsRead(auth.user.id);
      return send(res, 200, { user: auth.user, course, progress, submissions, notifications });
    }

    if (pathname === '/api/certificates/mine' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { certificates: await listCertificatesForUser(auth.user.id) });
    }

    if (pathname === '/api/certificates' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const body = await parseBody(req);
      const fileName = String(body.fileName || '').trim();
      const fileData = String(body.fileData || '').trim();
      const observation = String(body.observation || '').trim();
      const declaredHours = Number(body.declaredHours || 0) || 0;
      if (!fileName || !fileData) {
        return send(res, 400, { error: 'Selecione um certificado antes de enviar.' });
      }

      const certificateId = uid('cert');
      await db.prepare(`INSERT INTO certificates (
                          id, sender_id, sender_type, file_name, file_data, observation, declared_hours,
                          extracted_text, detected_hours, detected_name, detected_institution, detected_date,
                          detected_title, detected_course_name, found_fields, missing_fields, confidence_score,
                          human_summary, ocr_status, ocr_reason, admin_status, admin_feedback, approved_hours,
                          created_at, reviewed_at, reviewed_by, ocr_processed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, '', '', '', '', '', '[]', '[]', 0, '', 'nao_processado',
                                  'Aguardando análise do admin.', 'pendente', '', 0, ?, '', NULL, '')`)
        .run(certificateId, auth.user.id, auth.user.tipo, fileName, fileData, observation, declaredHours, nowIso());

      const admins = await db.prepare("SELECT * FROM users WHERE tipo = 'superadmin' AND ativo = 1 ORDER BY nome").all();
      for (const adminRow of admins) {
        await addNotification(adminRow.id, `${auth.user.nome} enviou um certificado para validação.`, 'warning');
        await queueEmail(adminRow.email, 'SIGAC - novo certificado enviado', `${auth.user.nome} enviou o certificado ${fileName} para análise.`, 'certificado');
      }
      await addNotification(auth.user.id, 'Seu certificado foi enviado e aguarda análise do administrador.', 'info');
      return send(res, 201, { certificate: await getCertificateById(certificateId) });
    }

    if (pathname === '/api/student/activities' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const activities = [];
      for (const activity of await listActivitiesForCourse(auth.user.courseId)) {
        activities.push({
          ...activity,
          submission: await getStudentSubmissionForActivity(auth.user.id, activity.id)
        });
      }
      return send(res, 200, { activities });
    }

    if (pathname === '/api/student/submissions' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const body = await parseBody(req);
      const activityId = String(body.activityId || '').trim();
      const arquivoNome = String(body.arquivoNome || '').trim();
      const arquivoData = String(body.arquivoData || '').trim();
      const observacao = String(body.observacao || '').trim();
      if (!activityId || !arquivoNome || !arquivoData) return send(res, 400, { error: 'Selecione um arquivo antes de enviar.' });
      const activity = await getActivityById(activityId);
      if (!activity || activity.courseId !== auth.user.courseId) return send(res, 400, { error: 'Atividade inválida para este aluno.' });
      let submission = await getStudentSubmissionForActivity(auth.user.id, activityId);
      const latest = getLatestVersion(submission);
      if (latest && latest.status === 'em_analise') return send(res, 400, { error: 'Seu último envio ainda está em análise.' });
      if (latest && latest.status === 'aprovado') return send(res, 400, { error: 'Esta atividade já foi aprovada.' });
      const versionNumber = latest ? latest.version + 1 : 1;
      if (!submission) {
        const submissionId = uid('sub');
        await db.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run(submissionId, activityId, auth.user.id, 'em_analise');
        submission = { id: submissionId };
      }
      await db.prepare(`INSERT INTO submission_versions (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em)
                        VALUES (?, ?, ?, ?, ?, 'em_analise', '', ?, '')`)
        .run(submission.id, versionNumber, arquivoNome, arquivoData, observacao, nowIso());
      await db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run('em_analise', submission.id);
      const coordinators = await db.prepare(`SELECT users.* FROM users
                                             JOIN coordinator_courses cc ON cc.user_id = users.id
                                             WHERE users.tipo = 'coordenador' AND users.ativo = 1 AND cc.course_id = ?`).all(activity.courseId);
      for (const coordRow of coordinators) {
        await addNotification(coordRow.id, `${auth.user.nome} enviou um arquivo para a atividade ${activity.titulo}.`, 'warning');
        await queueEmail(coordRow.email, 'SIGAC - novo envio para análise', `${auth.user.nome} enviou um novo arquivo na atividade ${activity.titulo}.`, 'envio');
      }
      await addNotification(auth.user.id, `Seu arquivo da atividade ${activity.titulo} foi enviado para análise.`, 'info');
      return send(res, 200, { submission: await getSubmissionById(submission.id) });
    }

    if (pathname === '/api/coordinator/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const courseIds = await getCoordinatorCourseIds(auth.user.id);
      const courses = [];
      for (const courseId of courseIds) courses.push(await getCourseById(courseId));
      return send(res, 200, { user: auth.user, dashboard: await getCoordinatorDashboardData(auth.user.id), courses });
    }

    if (pathname === '/api/coordinator/activities' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      if (!(await getCoordinatorCourseIds(auth.user.id)).includes(courseId)) return send(res, 400, { error: 'Você só pode publicar para seus cursos.' });
      if (!body.titulo || !body.descricao || !courseId || !body.horas) return send(res, 400, { error: 'Preencha título, descrição, curso e horas.' });
      const activity = {
        id: uid('activity'),
        titulo: String(body.titulo).trim(),
        descricao: String(body.descricao).trim(),
        courseId,
        horas: Number(body.horas || 0),
        prazo: String(body.prazo || '').trim(),
        materialNome: String(body.materialNome || '').trim(),
        materialArquivo: String(body.materialArquivo || '').trim(),
        createdBy: auth.user.id,
        createdAt: nowIso()
      };
      await db.prepare(`INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(activity.id, activity.titulo, activity.descricao, activity.courseId, activity.horas, activity.prazo, activity.materialNome, activity.materialArquivo, activity.createdBy, activity.createdAt);
      const students = await db.prepare('SELECT * FROM users WHERE tipo = ? AND ativo = 1 AND course_id = ?').all('aluno', courseId);
      for (const row of students) {
        await addNotification(row.id, `Nova atividade publicada: ${activity.titulo}.`, 'info');
        await queueEmail(row.email, 'SIGAC - nova atividade', `Foi publicada uma nova atividade para o seu curso: ${activity.titulo}.`, 'atividade');
      }
      return send(res, 200, { activity });
    }

    if (pathname.match(/^\/api\/coordinator\/submissions\/[^/]+\/evaluate$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const submissionId = pathname.split('/')[4];
      const body = await parseBody(req);
      const status = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim();
      const submission = await getSubmissionById(submissionId);
      if (!submission) return send(res, 404, { error: 'Envio não encontrado.' });
      const activity = await getActivityById(submission.activityId);
      if (!activity || !(await getCoordinatorCourseIds(auth.user.id)).includes(activity.courseId)) {
        return send(res, 403, { error: 'Você não pode avaliar este envio.' });
      }
      const latest = getLatestVersion(submission);
      if (!latest || latest.status !== 'em_analise') return send(res, 400, { error: 'Este envio não está pendente.' });
      await db.prepare('UPDATE submission_versions SET status = ?, feedback = ?, avaliada_em = ? WHERE id = ?')
        .run(status, feedback, nowIso(), latest.id);
      await db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run(status, submissionId);
      const student = await getUserById(submission.studentId);
      const human = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      await addNotification(student.id, `Seu envio da atividade ${activity.titulo} foi ${human}.`, status === 'aprovado' ? 'success' : 'warning');
      await queueEmail(student.email, `SIGAC - envio ${human}`, `Sua atividade ${activity.titulo} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'avaliacao');
      return send(res, 200, { submission: await getSubmissionById(submissionId) });
    }

    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      return send(res, 200, { user: auth.user, dashboard: await getAdminDashboardData() });
    }

    if (pathname === '/api/admin/users' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '').trim();
      const tipo = String(body.tipo || '').trim();
      const courseId = String(body.courseId || '').trim();
      const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter(Boolean))] : [];
      if (!nome || !email || !senha || !['aluno', 'coordenador'].includes(tipo)) {
        return send(res, 400, { error: 'Preencha nome, e-mail, senha e tipo corretamente.' });
      }
      const exists = await db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
      if (exists) return send(res, 400, { error: 'Este e-mail já está cadastrado.' });
      const id = uid('user');
      await db.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, nome, email, hashPassword(senha), tipo, tipo === 'aluno' ? courseId || null : null, nowIso());
      if (tipo === 'coordenador') {
        const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
        for (const cId of courseIds) {
          await insert.run(id, cId);
        }
      }
      await addNotification(id, 'Seu acesso ao SIGAC foi criado.', 'info');
      await queueEmail(email, 'SIGAC - acesso criado', `Olá, ${nome}. Seu acesso ao SIGAC foi criado com sucesso.`, 'boas-vindas');
      return send(res, 200, { user: await getUserById(id) });
    }

    if (pathname.match(/^\/api\/admin\/users\/[^/]+\/status$/) && req.method === 'PATCH') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const userId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!row || row.tipo === 'superadmin') return send(res, 400, { error: 'Usuário inválido.' });
      await db.prepare('UPDATE users SET ativo = ? WHERE id = ?').run(body.ativo ? 1 : 0, userId);
      return send(res, 200, { user: await getUserById(userId) });
    }

    if (pathname === '/api/admin/courses' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const sigla = String(body.sigla || '').trim().toUpperCase();
      const nome = String(body.nome || '').trim();
      const area = String(body.area || '').trim() || 'Geral';
      const turno = String(body.turno || '').trim() || 'Noite';
      const defaultHorasMeta = await getSetting('horasMetaPadrao', '120');
      const horasMeta = Number(body.horasMeta || defaultHorasMeta || 120);
      if (!sigla || !nome) return send(res, 400, { error: 'Informe sigla e nome do curso.' });
      const exists = await db.prepare('SELECT 1 FROM courses WHERE UPPER(sigla) = ?').get(sigla);
      if (exists) return send(res, 400, { error: 'Já existe um curso com esta sigla.' });
      const id = uid('course');
      await db.prepare('INSERT INTO courses (id, sigla, nome, area, turno, horas_meta) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, sigla, nome, area, turno, horasMeta);
      return send(res, 200, { course: await getCourseById(id) });
    }

    if (pathname.match(/^\/api\/admin\/students\/[^/]+\/course$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const studentId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(studentId);
      const course = await getCourseById(String(body.courseId || ''));
      if (!row || row.tipo !== 'aluno') return send(res, 400, { error: 'Selecione um aluno válido.' });
      if (!course) return send(res, 400, { error: 'Selecione um curso válido.' });
      await db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(course.id, studentId);
      await addNotification(studentId, `Você foi vinculado ao curso ${course.sigla}.`, 'info');
      return send(res, 200, { user: await getUserById(studentId) });
    }

    if (pathname.match(/^\/api\/admin\/coordinators\/[^/]+\/courses$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const coordinatorId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(coordinatorId);
      const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter(Boolean))] : [];
      if (!row || row.tipo !== 'coordenador') return send(res, 400, { error: 'Selecione um coordenador válido.' });
      await db.prepare('DELETE FROM coordinator_courses WHERE user_id = ?').run(coordinatorId);
      const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
      for (const courseId of courseIds) await insert.run(coordinatorId, courseId);
      await addNotification(coordinatorId, 'Seus vínculos de coordenação foram atualizados.', 'info');
      return send(res, 200, { user: await getUserById(coordinatorId) });
    }

    if (pathname === '/api/admin/opportunities' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const titulo = String(body.titulo || '').trim();
      const descricao = String(body.descricao || '').trim();
      const horas = Number(body.horas || 0);
      if (!titulo || !descricao || !horas) return send(res, 400, { error: 'Preencha título, descrição e horas da oportunidade.' });
      const id = uid('opp');
      await db.prepare('INSERT INTO opportunities (id, titulo, descricao, horas, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, titulo, descricao, horas, auth.user.id, nowIso());
      return send(res, 200, { opportunity: (await listOpportunities()).find((item) => item.id === id) });
    }

    if (pathname === '/api/admin/settings' && req.method === 'PUT') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const horasMetaPadrao = Number(body.horasMetaPadrao || await getSetting('horasMetaPadrao', '120'));
      await setSetting('horasMetaPadrao', horasMetaPadrao);
      await setSetting('emailNotificationsEnabled', body.emailNotificationsEnabled ? 'true' : 'false');
      await setSetting('ocrDisponivel', body.ocrDisponivel ? 'true' : 'false');
      await setSetting('updatedAt', nowIso());
      if (body.courseTargets && typeof body.courseTargets === 'object') {
        const updateCourse = db.prepare('UPDATE courses SET horas_meta = ? WHERE id = ?');
        for (const [courseId, value] of Object.entries(body.courseTargets)) {
          await updateCourse.run(Number(value || horasMetaPadrao), courseId);
        }
      }
      return send(res, 200, { settings: (await getAdminDashboardData()).settings });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+\/ocr$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const current = await getCertificateById(certificateId);
      if (!current) return send(res, 404, { error: 'Certificado não encontrado.' });

      const result = body && typeof body === 'object' ? body : {};
      const detectedHours = Number(result.detectedHours || 0) || 0;
      const foundFields = Array.isArray(result.foundFields) ? result.foundFields.filter(Boolean) : [];
      const missingFields = Array.isArray(result.missingFields) ? result.missingFields.filter(Boolean) : [];
      const ocrStatus = String(result.ocrStatus || 'analise_manual').trim() || 'analise_manual';
      const approvedHours = current.adminStatus === 'pendente' && ocrStatus === 'aprovado_automatico'
        ? Number(detectedHours || current.declaredHours || 0)
        : Number(current.approvedHours || 0);

      await db.prepare(`UPDATE certificates
                        SET extracted_text = ?, detected_hours = ?, detected_name = ?, detected_institution = ?,
                            detected_date = ?, detected_title = ?, detected_course_name = ?, found_fields = ?,
                            missing_fields = ?, confidence_score = ?, human_summary = ?, ocr_status = ?,
                            ocr_reason = ?, approved_hours = ?, ocr_processed_at = ?
                        WHERE id = ?`)
        .run(
          String(result.extractedText || '').trim(),
          detectedHours,
          String(result.detectedName || '').trim(),
          String(result.detectedInstitution || '').trim(),
          String(result.detectedDate || '').trim(),
          String(result.detectedTitle || '').trim(),
          String(result.detectedCourseName || '').trim(),
          JSON.stringify(foundFields),
          JSON.stringify(missingFields),
          Number(result.confidenceScore || 0) || 0,
          String(result.humanSummary || '').trim(),
          ocrStatus,
          String(result.ocrReason || 'Pré-análise concluída.').trim(),
          approvedHours,
          nowIso(),
          certificateId
        );

      if (current.senderId) {
        await addNotification(current.senderId, `O OCR analisou seu certificado e marcou o status como ${ocrStatus.replaceAll('_', ' ')}.`, 'info');
      }
      return send(res, 200, { certificate: await getCertificateById(certificateId) });
    }

    if (pathname.match(/^\/api\/admin\/certificates\/[^/]+\/review$/) && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const certificateId = pathname.split('/')[4];
      const body = await parseBody(req);
      const certificate = await getCertificateById(certificateId);
      if (!certificate) return send(res, 404, { error: 'Certificado não encontrado.' });

      const finalStatus = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim();
      const approvedHours = finalStatus === 'aprovado'
        ? Number(certificate.detectedHours || certificate.declaredHours || certificate.approvedHours || 0)
        : 0;

      await db.prepare(`UPDATE certificates
                        SET admin_status = ?, admin_feedback = ?, reviewed_at = ?, reviewed_by = ?, approved_hours = ?
                        WHERE id = ?`)
        .run(finalStatus, feedback, nowIso(), auth.user.id, approvedHours, certificateId);

      const updated = await getCertificateById(certificateId);
      const human = finalStatus === 'aprovado' ? 'aprovado' : 'rejeitado';
      if (updated.sender?.id) {
        await addNotification(updated.sender.id, `Seu certificado ${updated.fileName} foi ${human} pelo administrador.`, finalStatus === 'aprovado' ? 'success' : 'warning');
      }
      if (updated.sender?.email) {
        await queueEmail(updated.sender.email, `SIGAC - certificado ${human}`, `O certificado ${updated.fileName} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'certificado-avaliacao');
      }
      return send(res, 200, { certificate: updated });
    }

    if (pathname === '/api/admin/reset-demo' && req.method === 'POST') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      await transaction(async (tx) => {
        await tx.exec(`
          DELETE FROM sessions;
          DELETE FROM emails;
          DELETE FROM notifications;
          DELETE FROM submission_versions;
          DELETE FROM submissions;
          DELETE FROM activities;
          DELETE FROM certificates;
          DELETE FROM opportunity_registrations;
          DELETE FROM opportunities;
          DELETE FROM coordinator_courses;
          DELETE FROM users;
          DELETE FROM courses;
          DELETE FROM settings;
        `);
      });
      await seedIfEmpty();
      const adminRow = await db.prepare("SELECT * FROM users WHERE email = 'einstein@sigac.com'").get();
      const user = adminRow ? await serializeUser(adminRow) : null;
      const token = user ? await createSession(user.id) : '';
      return send(res, 200, { ok: true, token, user });
    }

    if (pathname === '/api/admin/email-log' && req.method === 'GET') {
      const auth = await requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const lines = (await db.prepare('SELECT * FROM emails ORDER BY created_at DESC').all())
        .map((mail) => `${mail.created_at} | ${mail.to_email} | ${mail.subject} | ${mail.status}`);
      return send(res, 200, lines.join('\n') || 'Nenhum e-mail simulado foi registrado.', {
        'Content-Disposition': 'attachment; filename="sigac-email-log.txt"'
      });
    }

    const safePath = pathname === '/' ? '/loginsigac.html' : pathname;
    const filePath = path.join(ROOT, safePath);
    if (!filePath.startsWith(ROOT)) return notFound(res);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[SIGAC ERROR]', error);
    send(res, 500, { error: error.message || 'Erro interno no servidor.' });
  }
});

async function bootstrap() {
  await initDatabase();
  await seedIfEmpty();
  server.listen(PORT, () => {
    console.log(`SIGAC rodando em http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('[SIGAC BOOT ERROR]', error);
  process.exit(1);
});
