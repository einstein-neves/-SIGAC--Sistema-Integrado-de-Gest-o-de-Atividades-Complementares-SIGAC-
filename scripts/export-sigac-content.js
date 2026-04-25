require('dotenv').config({ quiet: true });

const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

function getSslConfig(databaseUrl) {
  const urlValue = /(?:^|[?&])sslmode=([^&]+)/i.exec(databaseUrl)?.[1]?.toLowerCase()
    || /(?:^|[?&])ssl=(true|1)/i.exec(databaseUrl)?.[1]?.toLowerCase();
  if (['false', '0', 'disable', 'off'].includes(urlValue || '')) return false;
  if (['true', '1', 'require', 'on', 'verify-full', 'verify-ca', 'prefer'].includes(urlValue || '')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definido.');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: getSslConfig(databaseUrl)
  });

  await client.connect();

  try {
    const databaseInfo = await client.query(`
      SELECT current_database() AS database, current_user AS username, version() AS version
    `);

    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tableResult.rows.map((row) => row.table_name);
    const schema = {};
    const data = {};
    const counts = {};

    for (const tableName of tables) {
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      schema[tableName] = columnsResult.rows;

      const rowsResult = await client.query(`SELECT * FROM "${tableName}"`);
      data[tableName] = rowsResult.rows;
      counts[tableName] = rowsResult.rowCount;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      database: databaseInfo.rows[0],
      tables,
      counts,
      schema,
      data
    };

    const root = path.resolve(__dirname, '..');
    const exportDir = path.join(root, 'exports');
    const stamp = timestampForFile();
    const jsonPath = path.join(exportDir, `sigac-content-${stamp}.json`);
    const summaryPath = path.join(exportDir, `sigac-content-${stamp}.txt`);

    await fs.mkdir(exportDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(exportPayload, null, 2), 'utf8');

    const summaryLines = [
      `Exportado em: ${exportPayload.exportedAt}`,
      `Banco: ${exportPayload.database.database}`,
      `Usuario: ${exportPayload.database.username}`,
      '',
      'Tabelas exportadas:'
    ];

    for (const tableName of tables) {
      summaryLines.push(`- ${tableName}: ${counts[tableName]} registro(s)`);
    }

    await fs.writeFile(summaryPath, summaryLines.join('\n'), 'utf8');

    console.log(JSON.stringify({
      jsonPath,
      summaryPath,
      tables,
      counts
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
