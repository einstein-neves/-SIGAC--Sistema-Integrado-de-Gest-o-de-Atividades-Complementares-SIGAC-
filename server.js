const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'sigac.sqlite');

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  area TEXT NOT NULL,
  turno TEXT NOT NULL,
  horas_meta INTEGER NOT NULL DEFAULT 120
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('superadmin','coordenador','aluno')),
  ativo INTEGER NOT NULL DEFAULT 1,
  course_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS coordinator_courses (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  horas INTEGER NOT NULL,
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  FOREIGN KEY (criado_por) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS opportunity_registrations (
  opportunity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (opportunity_id, user_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  course_id TEXT NOT NULL,
  horas INTEGER NOT NULL,
  prazo TEXT,
  material_nome TEXT,
  material_arquivo TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  current_status TEXT NOT NULL DEFAULT 'em_analise',
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submission_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_data TEXT NOT NULL,
  observacao TEXT,
  status TEXT NOT NULL,
  feedback TEXT,
  enviada_em TEXT NOT NULL,
  avaliada_em TEXT,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const textDataUrl = (text) => `data:text/plain;base64,${Buffer.from(String(text || ''), 'utf8').toString('base64')}`;
const jsonParse = (value, fallback = null) => {
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

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

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count > 0) return;

  const ads = 'course_ads';
  const log = 'course_log';
  const rh = 'course_rh';

  const adminId = 'user_admin';
  const coordAds = 'user_coord_ads';
  const coordLog = 'user_coord_log';
  const alunoAds = 'user_aluno_ads';
  const alunoAds2 = 'user_aluno_ads_2';
  const alunoLog = 'user_aluno_log';

  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('horasMetaPadrao', '120');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('emailNotificationsEnabled', 'true');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('ocrDisponivel', 'false');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('updatedAt', nowIso());

  const insertCourse = db.prepare('INSERT INTO courses (id, sigla, nome, area, turno, horas_meta) VALUES (?, ?, ?, ?, ?, ?)');
  insertCourse.run(ads, 'ADS', 'Análise e Desenvolvimento de Sistemas', 'Tecnologia', 'Noite', 120);
  insertCourse.run(log, 'LOG', 'Logística', 'Gestão', 'Tarde', 100);
  insertCourse.run(rh, 'RH', 'Recursos Humanos', 'Gestão', 'Noite', 90);

  const insertUser = db.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertUser.run(adminId, 'Einstein', 'einstein@sigac.com', hashPassword('123456789'), 'superadmin', 1, null, nowIso());
  insertUser.run(coordAds, 'Marina Costa', 'coord.ads@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
  insertUser.run(coordLog, 'Paulo Nobre', 'coord.log@sigac.com', hashPassword('123456'), 'coordenador', 1, null, nowIso());
  insertUser.run(alunoAds, 'Ana Clara', 'aluno.ads@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
  insertUser.run(alunoAds2, 'João Pedro', 'aluno.ads2@sigac.com', hashPassword('123456'), 'aluno', 1, ads, nowIso());
  insertUser.run(alunoLog, 'Lívia Souza', 'aluno.log@sigac.com', hashPassword('123456'), 'aluno', 1, log, nowIso());

  const insertCoordCourse = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
  insertCoordCourse.run(coordAds, ads);
  insertCoordCourse.run(coordLog, log);

  const insertOpp = db.prepare('INSERT INTO opportunities (id, titulo, descricao, horas, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)');
  insertOpp.run('opp_1', 'Minicurso de Git e GitHub', 'Oficina prática com certificado institucional.', 8, adminId, nowIso());
  insertOpp.run('opp_2', 'Feira de Empregabilidade SENAC', 'Participação com horas complementares para alunos e coordenação.', 6, adminId, nowIso());
  db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_1', alunoAds);
  db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_2', coordAds);
  db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run('opp_2', alunoLog);

  const insertActivity = db.prepare('INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertActivity.run('activity_ads_1', 'Seminário sobre Arquitetura de Software', 'Preparar um resumo crítico e enviar o comprovante de participação.', ads, 12, '', 'roteiro-seminario.txt', textDataUrl('Roteiro do seminário de Arquitetura de Software.\n\n1. Leia o material base.\n2. Participe do encontro.\n3. Envie o comprovante.'), coordAds, nowIso());
  insertActivity.run('activity_log_1', 'Relatório de Visita Técnica', 'Enviar relatório da visita técnica com no mínimo duas páginas.', log, 10, '', 'modelo-relatorio.txt', textDataUrl('Modelo de relatório da visita técnica de Logística.'), coordLog, nowIso());

  db.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run('sub_1', 'activity_ads_1', alunoAds2, 'em_analise');
  db.prepare(`INSERT INTO submission_versions (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('sub_1', 1, 'comprovante-joao.txt', textDataUrl('Comprovante de participação do João Pedro.'), 'Segue meu comprovante.', 'em_analise', '', nowIso(), '');

  addNotification(alunoAds, 'Você já está inscrita no minicurso de Git e GitHub.', 'info');
  addNotification(coordAds, 'Há um envio pendente para análise em ADS.', 'warning');
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

function addNotification(userId, mensagem, tipo = 'info') {
  db.prepare('INSERT INTO notifications (id, user_id, mensagem, tipo, created_at, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(uid('ntf'), userId, mensagem, tipo, nowIso());
}

function queueEmail(to, subject, body, kind = 'geral') {
  if (getSetting('emailNotificationsEnabled', 'true') !== 'true') return null;
  const email = { id: uid('mail'), to, subject, body, kind, status: 'simulado', createdAt: nowIso() };
  db.prepare('INSERT INTO emails (id, to_email, subject, body, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(email.id, email.to, email.subject, email.body, email.kind, email.status, email.createdAt);
  return email;
}

function getCoordinatorCourseIds(userId) {
  return db.prepare('SELECT course_id FROM coordinator_courses WHERE user_id = ? ORDER BY course_id').all(userId).map((row) => row.course_id);
}

function getUserById(userId) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return serializeUser(row);
}

function serializeUser(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    tipo: row.tipo,
    ativo: !!row.ativo,
    courseId: row.course_id || '',
    courseIds: row.tipo === 'coordenador' ? getCoordinatorCourseIds(row.id) : [],
    createdAt: row.created_at
  };
}

function getCourseById(courseId) {
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
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

function listCourses() {
  return db.prepare('SELECT * FROM courses ORDER BY sigla').all().map((row) => ({
    id: row.id,
    sigla: row.sigla,
    nome: row.nome,
    area: row.area,
    turno: row.turno,
    horasMeta: Number(row.horas_meta || 0)
  }));
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY nome').all().map(serializeUser);
}

function listOpportunities() {
  const opportunities = db.prepare('SELECT * FROM opportunities ORDER BY criado_em DESC').all();
  const regStmt = db.prepare('SELECT user_id FROM opportunity_registrations WHERE opportunity_id = ? ORDER BY user_id');
  return opportunities.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    horas: Number(row.horas || 0),
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    inscritos: regStmt.all(row.id).map((item) => item.user_id)
  }));
}

function getActivityById(id) {
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!row) return null;
  return serializeActivity(row);
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

function listActivitiesForCourse(courseId) {
  return db.prepare('SELECT * FROM activities WHERE course_id = ? ORDER BY created_at DESC').all(courseId).map(serializeActivity);
}

function listActivitiesForCoordinator(coordinatorId) {
  return db.prepare('SELECT * FROM activities WHERE created_by = ? ORDER BY created_at DESC').all(coordinatorId).map(serializeActivity);
}

function getSubmissionVersions(submissionId) {
  return db.prepare('SELECT * FROM submission_versions WHERE submission_id = ? ORDER BY version ASC').all(submissionId).map((row) => ({
    id: row.id,
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

function serializeSubmission(row) {
  const versions = getSubmissionVersions(row.id);
  return {
    id: row.id,
    activityId: row.activity_id,
    studentId: row.student_id,
    currentStatus: row.current_status,
    versions
  };
}

function getSubmissionById(id) {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  return row ? serializeSubmission(row) : null;
}

function getStudentSubmissionForActivity(studentId, activityId) {
  const row = db.prepare('SELECT * FROM submissions WHERE student_id = ? AND activity_id = ?').get(studentId, activityId);
  return row ? serializeSubmission(row) : null;
}

function listSubmissionsForStudent(studentId) {
  return db.prepare('SELECT * FROM submissions WHERE student_id = ? ORDER BY id DESC').all(studentId).map(serializeSubmission);
}

function getLatestVersion(submission) {
  return submission?.versions?.[submission.versions.length - 1] || null;
}

function getStudentProgress(studentId) {
  const student = getUserById(studentId);
  if (!student) return { total: 0, target: 0, percent: 0, approvedHours: 0, opportunityHours: 0 };

  const approvedHours = listSubmissionsForStudent(studentId).reduce((sum, submission) => {
    const latest = getLatestVersion(submission);
    if (!latest || latest.status !== 'aprovado') return sum;
    const activity = getActivityById(submission.activityId);
    return sum + Number(activity?.horas || 0);
  }, 0);

  const opportunityHours = listOpportunities().reduce((sum, item) => item.inscritos.includes(studentId) ? sum + Number(item.horas || 0) : sum, 0);
  const course = getCourseById(student.courseId);
  const target = Number(course?.horasMeta || getSetting('horasMetaPadrao', '120') || 120);
  const total = approvedHours + opportunityHours;
  const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  return { total, target, percent, approvedHours, opportunityHours };
}

function listCoordinatorStudents(coordinatorId) {
  const courseIds = getCoordinatorCourseIds(coordinatorId);
  const stmt = db.prepare('SELECT * FROM users WHERE tipo = ? AND ativo = 1 AND course_id = ? ORDER BY nome');
  const result = [];
  for (const courseId of courseIds) {
    const course = getCourseById(courseId);
    for (const row of stmt.all('aluno', courseId)) {
      const student = serializeUser(row);
      result.push({ ...student, course, progress: getStudentProgress(student.id) });
    }
  }
  return result;
}

function listSubmissionsForCoordinator(coordinatorId) {
  const courseIds = new Set(getCoordinatorCourseIds(coordinatorId));
  return db.prepare('SELECT * FROM submissions').all()
    .map(serializeSubmission)
    .map((submission) => {
      const activity = getActivityById(submission.activityId);
      if (!activity || !courseIds.has(activity.courseId)) return null;
      const student = getUserById(submission.studentId);
      const course = getCourseById(activity.courseId);
      const latest = getLatestVersion(submission);
      return { ...submission, activity, student, course, latest };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.latest?.enviadaEm || 0) - new Date(a.latest?.enviadaEm || 0));
}

function getNotificationsForUser(userId) {
  return db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId).map((row) => ({
    id: row.id,
    userId: row.user_id,
    mensagem: row.mensagem,
    tipo: row.tipo,
    createdAt: row.created_at,
    read: !!row.read
  }));
}

function markNotificationsRead(userId) {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

function getAdminDashboardData() {
  const users = listUsers();
  const activeUsers = users.filter((item) => item.ativo);
  const submissions = db.prepare('SELECT * FROM submissions').all().map(serializeSubmission);
  const pending = submissions.filter((item) => getLatestVersion(item)?.status === 'em_analise').length;
  const approved = submissions.filter((item) => getLatestVersion(item)?.status === 'aprovado').length;
  const rejected = submissions.filter((item) => getLatestVersion(item)?.status === 'rejeitado').length;

  const courses = listCourses().map((course) => {
    const students = users.filter((user) => user.tipo === 'aluno' && user.ativo && user.courseId === course.id)
      .map((student) => ({ ...student, progress: getStudentProgress(student.id) }));
    const courseSubmissions = submissions.filter((submission) => getActivityById(submission.activityId)?.courseId === course.id);
    const courseApproved = courseSubmissions.filter((item) => getLatestVersion(item)?.status === 'aprovado').length;
    const taxaAprovacao = courseSubmissions.length ? Math.round((courseApproved / courseSubmissions.length) * 100) : 0;
    return { ...course, students, totalAlunos: students.length, taxaAprovacao };
  });

  return {
    totals: {
      totalCursos: courses.length,
      totalUsuarios: activeUsers.length,
      totalOportunidades: listOpportunities().length,
      pendentes: pending,
      aprovados: approved,
      rejeitados: rejected
    },
    courses,
    users,
    opportunities: listOpportunities(),
    emails: db.prepare('SELECT * FROM emails ORDER BY created_at DESC').all().map((row) => ({
      id: row.id,
      to: row.to_email,
      subject: row.subject,
      body: row.body,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at
    })),
    settings: {
      horasMetaPadrao: Number(getSetting('horasMetaPadrao', '120')),
      emailNotificationsEnabled: getSetting('emailNotificationsEnabled', 'true') === 'true',
      ocrDisponivel: getSetting('ocrDisponivel', 'false') === 'true'
    }
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
    opportunities: listOpportunities(),
    activities: listActivitiesForCoordinator(coordinatorId)
  };
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, nowIso());
  return token;
}

function getSessionUser(token) {
  const row = db.prepare(`SELECT users.* FROM sessions
                          JOIN users ON users.id = sessions.user_id
                          WHERE sessions.token = ?`).get(token);
  return row ? serializeUser(row) : null;
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const contentType = typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
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

function requireAuth(req, res, urlObj, roles = null) {
  const token = getToken(req, urlObj);
  const user = token ? getSessionUser(token) : null;
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

seedIfEmpty();

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  try {
    // API
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      const row = db.prepare('SELECT * FROM users WHERE email = ? AND ativo = 1').get(email);
      if (!row || !verifyPassword(senha, row.senha_hash)) {
        return send(res, 401, { error: 'E-mail ou senha incorretos.' });
      }
      const user = serializeUser(row);
      const token = createSession(user.id);
      return send(res, 200, { token, user });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getToken(req, urlObj);
      if (token) deleteSession(token);
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      if (!email || !senha) return send(res, 400, { error: 'Informe e-mail e nova senha.' });
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!row) return send(res, 404, { error: 'E-mail não encontrado.' });
      db.prepare('UPDATE users SET senha_hash = ? WHERE id = ?').run(hashPassword(senha), row.id);
      addNotification(row.id, 'Sua senha foi redefinida com sucesso.', 'info');
      queueEmail(email, 'SIGAC - senha redefinida', 'Sua senha foi alterada com sucesso no SIGAC.', 'reset-senha');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { user: auth.user });
    }

    if (pathname === '/api/courses' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { courses: listCourses() });
    }

    if (pathname === '/api/opportunities' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, ['superadmin', 'coordenador', 'aluno']);
      if (!auth) return;
      return send(res, 200, { opportunities: listOpportunities() });
    }

    if (pathname.match(/^\/api\/opportunities\/[^/]+\/toggle$/) && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, ['coordenador', 'aluno']);
      if (!auth) return;
      const opportunityId = pathname.split('/')[3];
      const current = listOpportunities().find((item) => item.id === opportunityId);
      if (!current) return send(res, 404, { error: 'Oportunidade não encontrada.' });
      const exists = db.prepare('SELECT 1 FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').get(opportunityId, auth.user.id);
      if (exists) {
        db.prepare('DELETE FROM opportunity_registrations WHERE opportunity_id = ? AND user_id = ?').run(opportunityId, auth.user.id);
        addNotification(auth.user.id, `Você saiu da oportunidade ${current.titulo}.`, 'info');
      } else {
        db.prepare('INSERT INTO opportunity_registrations (opportunity_id, user_id) VALUES (?, ?)').run(opportunityId, auth.user.id);
        addNotification(auth.user.id, `Você se inscreveu na oportunidade ${current.titulo}.`, 'info');
      }
      return send(res, 200, { opportunity: listOpportunities().find((item) => item.id === opportunityId) });
    }

    if (pathname === '/api/student/dashboard' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const course = getCourseById(auth.user.courseId);
      const progress = getStudentProgress(auth.user.id);
      const submissions = listSubmissionsForStudent(auth.user.id);
      const notifications = getNotificationsForUser(auth.user.id);
      markNotificationsRead(auth.user.id);
      return send(res, 200, { user: auth.user, course, progress, submissions, notifications });
    }

    if (pathname === '/api/student/activities' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const activities = listActivitiesForCourse(auth.user.courseId).map((activity) => ({
        ...activity,
        submission: getStudentSubmissionForActivity(auth.user.id, activity.id)
      }));
      return send(res, 200, { activities });
    }

    if (pathname === '/api/student/submissions' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'aluno');
      if (!auth) return;
      const body = await parseBody(req);
      const activityId = String(body.activityId || '').trim();
      const arquivoNome = String(body.arquivoNome || '').trim();
      const arquivoData = String(body.arquivoData || '').trim();
      const observacao = String(body.observacao || '').trim();
      if (!activityId || !arquivoNome || !arquivoData) return send(res, 400, { error: 'Selecione um arquivo antes de enviar.' });
      const activity = getActivityById(activityId);
      if (!activity || activity.courseId !== auth.user.courseId) return send(res, 400, { error: 'Atividade inválida para este aluno.' });
      let submission = getStudentSubmissionForActivity(auth.user.id, activityId);
      const latest = getLatestVersion(submission);
      if (latest && latest.status === 'em_analise') return send(res, 400, { error: 'Seu último envio ainda está em análise.' });
      if (latest && latest.status === 'aprovado') return send(res, 400, { error: 'Esta atividade já foi aprovada.' });
      const versionNumber = latest ? latest.version + 1 : 1;
      if (!submission) {
        const submissionId = uid('sub');
        db.prepare('INSERT INTO submissions (id, activity_id, student_id, current_status) VALUES (?, ?, ?, ?)').run(submissionId, activityId, auth.user.id, 'em_analise');
        submission = { id: submissionId };
      }
      db.prepare(`INSERT INTO submission_versions (submission_id, version, arquivo_nome, arquivo_data, observacao, status, feedback, enviada_em, avaliada_em)
                  VALUES (?, ?, ?, ?, ?, 'em_analise', '', ?, '')`)
        .run(submission.id, versionNumber, arquivoNome, arquivoData, observacao, nowIso());
      db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run('em_analise', submission.id);
      const coordinators = db.prepare(`SELECT users.* FROM users
                                       JOIN coordinator_courses cc ON cc.user_id = users.id
                                       WHERE users.tipo = 'coordenador' AND users.ativo = 1 AND cc.course_id = ?`).all(activity.courseId);
      for (const coordRow of coordinators) {
        addNotification(coordRow.id, `${auth.user.nome} enviou um arquivo para a atividade ${activity.titulo}.`, 'warning');
        queueEmail(coordRow.email, 'SIGAC - novo envio para análise', `${auth.user.nome} enviou um novo arquivo na atividade ${activity.titulo}.`, 'envio');
      }
      addNotification(auth.user.id, `Seu arquivo da atividade ${activity.titulo} foi enviado para análise.`, 'info');
      return send(res, 200, { submission: getSubmissionById(submission.id) });
    }

    if (pathname === '/api/coordinator/dashboard' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      return send(res, 200, { user: auth.user, dashboard: getCoordinatorDashboardData(auth.user.id), courses: getCoordinatorCourseIds(auth.user.id).map(getCourseById) });
    }

    if (pathname === '/api/coordinator/activities' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const body = await parseBody(req);
      const courseId = String(body.courseId || '').trim();
      if (!getCoordinatorCourseIds(auth.user.id).includes(courseId)) return send(res, 400, { error: 'Você só pode publicar para seus cursos.' });
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
      db.prepare(`INSERT INTO activities (id, titulo, descricao, course_id, horas, prazo, material_nome, material_arquivo, created_by, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(activity.id, activity.titulo, activity.descricao, activity.courseId, activity.horas, activity.prazo, activity.materialNome, activity.materialArquivo, activity.createdBy, activity.createdAt);
      const students = db.prepare('SELECT * FROM users WHERE tipo = ? AND ativo = 1 AND course_id = ?').all('aluno', courseId);
      for (const row of students) {
        addNotification(row.id, `Nova atividade publicada: ${activity.titulo}.`, 'info');
        queueEmail(row.email, 'SIGAC - nova atividade', `Foi publicada uma nova atividade para o seu curso: ${activity.titulo}.`, 'atividade');
      }
      return send(res, 200, { activity });
    }

    if (pathname.match(/^\/api\/coordinator\/submissions\/[^/]+\/evaluate$/) && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'coordenador');
      if (!auth) return;
      const submissionId = pathname.split('/')[4];
      const body = await parseBody(req);
      const status = body.status === 'aprovado' ? 'aprovado' : 'rejeitado';
      const feedback = String(body.feedback || '').trim();
      const submission = getSubmissionById(submissionId);
      if (!submission) return send(res, 404, { error: 'Envio não encontrado.' });
      const activity = getActivityById(submission.activityId);
      if (!activity || !getCoordinatorCourseIds(auth.user.id).includes(activity.courseId)) {
        return send(res, 403, { error: 'Você não pode avaliar este envio.' });
      }
      const latest = getLatestVersion(submission);
      if (!latest || latest.status !== 'em_analise') return send(res, 400, { error: 'Este envio não está pendente.' });
      db.prepare('UPDATE submission_versions SET status = ?, feedback = ?, avaliada_em = ? WHERE id = ?')
        .run(status, feedback, nowIso(), latest.id);
      db.prepare('UPDATE submissions SET current_status = ? WHERE id = ?').run(status, submissionId);
      const student = getUserById(submission.studentId);
      const human = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      addNotification(student.id, `Seu envio da atividade ${activity.titulo} foi ${human}.`, status === 'aprovado' ? 'success' : 'warning');
      queueEmail(student.email, `SIGAC - envio ${human}`, `Sua atividade ${activity.titulo} foi ${human}. Feedback: ${feedback || 'Sem observações.'}`, 'avaliacao');
      return send(res, 200, { submission: getSubmissionById(submissionId) });
    }

    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      return send(res, 200, { user: auth.user, dashboard: getAdminDashboardData() });
    }

    if (pathname === '/api/admin/users' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
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
      const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
      if (exists) return send(res, 400, { error: 'Este e-mail já está cadastrado.' });
      const id = uid('user');
      db.prepare('INSERT INTO users (id, nome, email, senha_hash, tipo, ativo, course_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, nome, email, hashPassword(senha), tipo, tipo === 'aluno' ? courseId || null : null, nowIso());
      if (tipo === 'coordenador') {
        const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
        for (const cId of courseIds) {
          insert.run(id, cId);
        }
      }
      addNotification(id, 'Seu acesso ao SIGAC foi criado.', 'info');
      queueEmail(email, 'SIGAC - acesso criado', `Olá, ${nome}. Seu acesso ao SIGAC foi criado com sucesso.`, 'boas-vindas');
      return send(res, 200, { user: getUserById(id) });
    }

    if (pathname.match(/^\/api\/admin\/users\/[^/]+\/status$/) && req.method === 'PATCH') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const userId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!row || row.tipo === 'superadmin') return send(res, 400, { error: 'Usuário inválido.' });
      db.prepare('UPDATE users SET ativo = ? WHERE id = ?').run(body.ativo ? 1 : 0, userId);
      return send(res, 200, { user: getUserById(userId) });
    }

    if (pathname === '/api/admin/courses' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const sigla = String(body.sigla || '').trim().toUpperCase();
      const nome = String(body.nome || '').trim();
      const area = String(body.area || '').trim() || 'Geral';
      const turno = String(body.turno || '').trim() || 'Noite';
      const horasMeta = Number(body.horasMeta || getSetting('horasMetaPadrao', '120') || 120);
      if (!sigla || !nome) return send(res, 400, { error: 'Informe sigla e nome do curso.' });
      const exists = db.prepare('SELECT 1 FROM courses WHERE UPPER(sigla) = ?').get(sigla);
      if (exists) return send(res, 400, { error: 'Já existe um curso com esta sigla.' });
      const id = uid('course');
      db.prepare('INSERT INTO courses (id, sigla, nome, area, turno, horas_meta) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, sigla, nome, area, turno, horasMeta);
      return send(res, 200, { course: getCourseById(id) });
    }

    if (pathname.match(/^\/api\/admin\/students\/[^/]+\/course$/) && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const studentId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId);
      const course = getCourseById(String(body.courseId || ''));
      if (!row || row.tipo !== 'aluno') return send(res, 400, { error: 'Selecione um aluno válido.' });
      if (!course) return send(res, 400, { error: 'Selecione um curso válido.' });
      db.prepare('UPDATE users SET course_id = ? WHERE id = ?').run(course.id, studentId);
      addNotification(studentId, `Você foi vinculado ao curso ${course.sigla}.`, 'info');
      return send(res, 200, { user: getUserById(studentId) });
    }

    if (pathname.match(/^\/api\/admin\/coordinators\/[^/]+\/courses$/) && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const coordinatorId = pathname.split('/')[4];
      const body = await parseBody(req);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(coordinatorId);
      const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter(Boolean))] : [];
      if (!row || row.tipo !== 'coordenador') return send(res, 400, { error: 'Selecione um coordenador válido.' });
      db.prepare('DELETE FROM coordinator_courses WHERE user_id = ?').run(coordinatorId);
      const insert = db.prepare('INSERT INTO coordinator_courses (user_id, course_id) VALUES (?, ?)');
      for (const courseId of courseIds) insert.run(coordinatorId, courseId);
      addNotification(coordinatorId, 'Seus vínculos de coordenação foram atualizados.', 'info');
      return send(res, 200, { user: getUserById(coordinatorId) });
    }

    if (pathname === '/api/admin/opportunities' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const titulo = String(body.titulo || '').trim();
      const descricao = String(body.descricao || '').trim();
      const horas = Number(body.horas || 0);
      if (!titulo || !descricao || !horas) return send(res, 400, { error: 'Preencha título, descrição e horas da oportunidade.' });
      const id = uid('opp');
      db.prepare('INSERT INTO opportunities (id, titulo, descricao, horas, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, titulo, descricao, horas, auth.user.id, nowIso());
      return send(res, 200, { opportunity: listOpportunities().find((item) => item.id === id) });
    }

    if (pathname === '/api/admin/settings' && req.method === 'PUT') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const body = await parseBody(req);
      const horasMetaPadrao = Number(body.horasMetaPadrao || getSetting('horasMetaPadrao', '120'));
      setSetting('horasMetaPadrao', horasMetaPadrao);
      setSetting('emailNotificationsEnabled', body.emailNotificationsEnabled ? 'true' : 'false');
      setSetting('updatedAt', nowIso());
      if (body.courseTargets && typeof body.courseTargets === 'object') {
        const updateCourse = db.prepare('UPDATE courses SET horas_meta = ? WHERE id = ?');
        for (const [courseId, value] of Object.entries(body.courseTargets)) {
          updateCourse.run(Number(value || horasMetaPadrao), courseId);
        }
      }
      return send(res, 200, { settings: getAdminDashboardData().settings });
    }

    if (pathname === '/api/admin/reset-demo' && req.method === 'POST') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      db.exec(`
        DELETE FROM sessions; DELETE FROM emails; DELETE FROM notifications; DELETE FROM submission_versions; DELETE FROM submissions;
        DELETE FROM activities; DELETE FROM opportunity_registrations; DELETE FROM opportunities; DELETE FROM coordinator_courses; DELETE FROM users; DELETE FROM courses; DELETE FROM settings;
      `);
      seedIfEmpty();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/email-log' && req.method === 'GET') {
      const auth = requireAuth(req, res, urlObj, 'superadmin');
      if (!auth) return;
      const lines = db.prepare('SELECT * FROM emails ORDER BY created_at DESC').all().map((mail) => `${mail.created_at} | ${mail.to_email} | ${mail.subject} | ${mail.status}`);
      return send(res, 200, lines.join('\n') || 'Nenhum e-mail simulado foi registrado.', {
        'Content-Disposition': 'attachment; filename="sigac-email-log.txt"'
      });
    }

    // static files
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
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[SIGAC ERROR]', error);
    send(res, 500, { error: error.message || 'Erro interno no servidor.' });
  }
});

server.listen(PORT, () => {
  console.log(`SIGAC rodando em http://localhost:${PORT}`);
});





