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
  if (['true', '1', 'require', 'on', 'verify-full', 'verify-ca', 'prefer'].includes(value)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: getSslConfig()
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
      created_at TEXT NOT NULL
    );
  `);
}

module.exports = {
  db,
  initDatabase,
  pool,
  transaction
};
