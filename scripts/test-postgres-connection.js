require('dotenv').config({ quiet: true });

const { Client } = require('pg');

async function main() {
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Informe uma DATABASE_URL como argumento ou no .env.');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: /sslmode=require|ssl=true/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined
  });

  await client.connect();
  const result = await client.query('SELECT current_database() AS database, current_user AS "user", version() AS version');
  console.log(JSON.stringify(result.rows[0], null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
