require('dotenv').config({ quiet: true });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  throw new Error('Defina a variavel de ambiente DATABASE_URL para conectar ao PostgreSQL.');
}

function getSslConfig() {
  const explicitValue = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || '').toLowerCase();
  const urlValue = /(?:^|[?&])sslmode=([^&]+)/i.exec(DATABASE_URL)?.[1]?.toLowerCase()
    || /(?:^|[?&])ssl=(true|1)/i.exec(DATABASE_URL)?.[1]?.toLowerCase();
  const value = explicitValue || urlValue || '';
  if (['false', '0', 'disable', 'off'].includes(value)) return false;
  if (['verify-full', 'verify-ca', 'true', '1', 'require', 'on', 'prefer'].includes(value)) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: getSslConfig(),
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000)
});

function toPgPlaceholders(text) {
  let index = 0;
  return String(text).replace(/\?/g, () => `$${++index}`);
}

async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

function splitStatements(sql) {
  return String(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

class Statement {
  constructor(executor, text) {
    this.executor = executor;
    this.text = toPgPlaceholders(text);
  }

  async get(...params) {
    const result = await this.executor.query(this.text, params);
    return result.rows[0];
  }

  async all(...params) {
    const result = await this.executor.query(this.text, params);
    return result.rows;
  }

  async run(...params) {
    const result = await this.executor.query(this.text, params);
    return { changes: result.rowCount || 0 };
  }
}

function createExecutor(executor) {
  return {
    prepare(text) {
      return new Statement(executor, text);
    },
    async exec(sql) {
      for (const statement of splitStatements(sql)) {
        await executor.query(statement);
      }
    }
  };
}

const db = createExecutor(pool);

async function transaction(callback) {
  return withClient(async (client) => {
    const tx = createExecutor(client);
    await client.query('BEGIN');
    try {
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function initDatabase() {
  await db.exec(`
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
      tipo TEXT NOT NULL CHECK (tipo IN ('superadmin', 'coordenador', 'aluno')),
      ativo INTEGER NOT NULL DEFAULT 1,
      course_id TEXT REFERENCES courses(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coordinator_courses (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS student_courses (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS activity_rules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      categoria TEXT NOT NULL,
      limite_maximo INTEGER NOT NULL DEFAULT 0,
      carga_minima INTEGER NOT NULL DEFAULT 0,
      exige_certificado INTEGER NOT NULL DEFAULT 1,
      exige_aprovacao INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      horas INTEGER NOT NULL,
      criado_por TEXT NOT NULL REFERENCES users(id),
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunity_registrations (
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (opportunity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      course_id TEXT NOT NULL REFERENCES courses(id),
      horas INTEGER NOT NULL,
      prazo TEXT,
      material_nome TEXT,
      material_arquivo TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_status TEXT NOT NULL DEFAULT 'em_analise'
    );

    CREATE TABLE IF NOT EXISTS submission_versions (
      id BIGSERIAL PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      arquivo_nome TEXT NOT NULL,
      arquivo_data TEXT NOT NULL,
      observacao TEXT,
      status TEXT NOT NULL,
      feedback TEXT,
      enviada_em TEXT NOT NULL,
      avaliada_em TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mensagem TEXT NOT NULL,
      tipo TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      observation TEXT,
      declared_hours INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT NOT NULL DEFAULT '',
      detected_hours INTEGER NOT NULL DEFAULT 0,
      detected_name TEXT NOT NULL DEFAULT '',
      detected_institution TEXT NOT NULL DEFAULT '',
      detected_date TEXT NOT NULL DEFAULT '',
      detected_title TEXT NOT NULL DEFAULT '',
      detected_course_name TEXT NOT NULL DEFAULT '',
      found_fields TEXT NOT NULL DEFAULT '[]',
      missing_fields TEXT NOT NULL DEFAULT '[]',
      confidence_score INTEGER NOT NULL DEFAULT 0,
      human_summary TEXT NOT NULL DEFAULT '',
      ocr_status TEXT NOT NULL DEFAULT 'nao_processado',
      ocr_reason TEXT NOT NULL DEFAULT 'Aguardando análise do admin.',
      admin_status TEXT NOT NULL DEFAULT 'pendente',
      admin_feedback TEXT NOT NULL DEFAULT '',
      approved_hours INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT REFERENCES users(id),
      ocr_processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TEXT;

    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT '';
    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS horas_declaradas INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_users_tipo_ativo ON users(tipo, ativo);
    CREATE INDEX IF NOT EXISTS idx_users_course_id ON users(course_id);

    CREATE INDEX IF NOT EXISTS idx_coordinator_courses_user_id ON coordinator_courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_coordinator_courses_course_id ON coordinator_courses(course_id);

    CREATE INDEX IF NOT EXISTS idx_student_courses_user_id ON student_courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_student_courses_course_id ON student_courses(course_id);

    CREATE INDEX IF NOT EXISTS idx_activity_rules_course_id ON activity_rules(course_id);

    CREATE INDEX IF NOT EXISTS idx_opportunity_registrations_opportunity_id ON opportunity_registrations(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opportunity_registrations_user_id ON opportunity_registrations(user_id);

    CREATE INDEX IF NOT EXISTS idx_activities_course_id ON activities(course_id);
    CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
    CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

    CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_activity_id ON submissions(activity_id);

    CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id ON submission_versions(submission_id);
    CREATE INDEX IF NOT EXISTS idx_submission_versions_status ON submission_versions(status);
    CREATE INDEX IF NOT EXISTS idx_submission_versions_enviada_em ON submission_versions(enviada_em);

    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    CREATE INDEX IF NOT EXISTS idx_certificates_sender_id ON certificates(sender_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_admin_status ON certificates(admin_status);
    CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at);

    CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

    INSERT INTO student_courses (user_id, course_id)
    SELECT id, course_id
    FROM users
    WHERE tipo = 'aluno' AND course_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    UPDATE emails SET status = 'simulado (fila local)' WHERE status = 'simulado';

    INSERT INTO activity_rules
      (id, course_id, categoria, limite_maximo, carga_minima, exige_certificado, exige_aprovacao, created_by, created_at)
    SELECT 'rule_' || id || '_eventos', id, 'Eventos', 30, 4, 1, 1, NULL, NOW()::TEXT
    FROM courses
    ON CONFLICT DO NOTHING;

    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
    VALUES ('audit_migration_requirements_2_7', NULL, 'migrou_requisitos_2_7', 'sistema', 'requirements-2-7',
            'Migração criou vínculos múltiplos de alunos, regras persistidas e logs de auditoria.', NOW()::TEXT)
    ON CONFLICT DO NOTHING;
  `);
}

module.exports = {
  db,
  initDatabase,
  pool,
  transaction
};
