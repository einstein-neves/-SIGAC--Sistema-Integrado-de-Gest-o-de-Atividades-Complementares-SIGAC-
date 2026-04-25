const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { initDatabase, transaction } = require('../db');

const ROOT = path.resolve(__dirname, '..');
const SQLITE_PATH = path.join(ROOT, 'data', 'sigac.sqlite');

const tables = [
  { name: 'settings', columns: ['key', 'value'] },
  { name: 'courses', columns: ['id', 'sigla', 'nome', 'area', 'turno', 'horas_meta'] },
  { name: 'users', columns: ['id', 'nome', 'email', 'senha_hash', 'tipo', 'ativo', 'course_id', 'created_at'] },
  { name: 'coordinator_courses', columns: ['user_id', 'course_id'] },
  { name: 'opportunities', columns: ['id', 'titulo', 'descricao', 'horas', 'criado_por', 'criado_em'] },
  { name: 'opportunity_registrations', columns: ['opportunity_id', 'user_id'] },
  { name: 'activities', columns: ['id', 'titulo', 'descricao', 'course_id', 'horas', 'prazo', 'material_nome', 'material_arquivo', 'created_by', 'created_at'] },
  { name: 'submissions', columns: ['id', 'activity_id', 'student_id', 'current_status'] },
  { name: 'submission_versions', columns: ['id', 'submission_id', 'version', 'arquivo_nome', 'arquivo_data', 'observacao', 'status', 'feedback', 'enviada_em', 'avaliada_em'] },
  { name: 'notifications', columns: ['id', 'user_id', 'mensagem', 'tipo', 'created_at', 'read'] },
  { name: 'emails', columns: ['id', 'to_email', 'subject', 'body', 'kind', 'status', 'created_at'] },
  { name: 'sessions', columns: ['token', 'user_id', 'created_at'] }
];

function buildInsertSql(table) {
  const columns = table.columns.join(', ');
  const placeholders = table.columns.map(() => '?').join(', ');
  return `INSERT INTO ${table.name} (${columns}) VALUES (${placeholders})`;
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.log(`SQLite não encontrado em ${SQLITE_PATH}. Nada para migrar.`);
    return;
  }

  await initDatabase();
  const sqlite = new DatabaseSync(SQLITE_PATH);

  try {
    const snapshot = tables.map((table) => ({
      ...table,
      rows: sqlite.prepare(`SELECT ${table.columns.join(', ')} FROM ${table.name}`).all()
    }));

    await transaction(async (tx) => {
      await tx.exec(`
        DELETE FROM sessions;
        DELETE FROM emails;
        DELETE FROM notifications;
        DELETE FROM submission_versions;
        DELETE FROM submissions;
        DELETE FROM activities;
        DELETE FROM opportunity_registrations;
        DELETE FROM opportunities;
        DELETE FROM coordinator_courses;
        DELETE FROM users;
        DELETE FROM courses;
        DELETE FROM settings;
      `);

      for (const table of snapshot) {
        if (!table.rows.length) continue;
        const insert = tx.prepare(buildInsertSql(table));
        for (const row of table.rows) {
          await insert.run(...table.columns.map((column) => row[column]));
        }
      }

      await tx.exec(`
        SELECT setval(
          pg_get_serial_sequence('submission_versions', 'id'),
          COALESCE((SELECT MAX(id) FROM submission_versions), 1),
          EXISTS (SELECT 1 FROM submission_versions)
        );
      `);
    });

    for (const table of snapshot) {
      console.log(`${table.name}: ${table.rows.length}`);
    }
    console.log('Migração SQLite -> PostgreSQL concluída.');
  } finally {
    sqlite.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
