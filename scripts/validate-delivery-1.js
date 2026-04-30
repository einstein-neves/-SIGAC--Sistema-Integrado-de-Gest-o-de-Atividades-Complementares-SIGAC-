const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const requiredFiles = [
  '.gitignore',
  '.env.example',
  'README.md',
  'manifest.json',
  'service-worker.js',
  'js/pwa.js',
  'vendor/chart.umd.min.js',
  'README-envio.txt',
  'preparar-envio.bat',
  'scripts/api-smoke-test.js',
  'docs/requisitos-entrega-1.md',
  'docs/casos-de-uso.md',
  'docs/arquitetura.md',
  'docs/plano-de-testes.md',
  'docs/entrega-1.md',
  'docs/roteiro-apresentacao-entrega-1.md'
];

const requiredIgnoreEntries = [
  'node_modules/',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.*.local',
  'dist/',
  'build/',
  'coverage/',
  '*.log',
  '*.sqlite',
  '*.sqlite-*',
  '*.db',
  '*.session',
  '*.sess',
  'data/',
  'exports/',
  '.sixth/',
  'tools/',
  'SIGAC-envio.zip'
];

const forbiddenZipEntries = [
  '.env',
  '.git/',
  'node_modules/',
  'data/',
  'exports/',
  '.sixth/',
  'tools/'
];

function fail(message) {
  console.error(`[SIGAC Entrega 1] ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(ROOT, file))) fail(`Arquivo obrigatorio ausente: ${file}`);
}

if (fs.existsSync(path.join(ROOT, '.gitignore'))) {
  const gitignore = read('.gitignore');
  for (const entry of requiredIgnoreEntries) {
    if (!gitignore.includes(entry)) fail(`.gitignore nao contem: ${entry}`);
  }
}

if (fs.existsSync(path.join(ROOT, '.env.example'))) {
  const envExample = read('.env.example');
  if (/neon\.tech/i.test(envExample)) {
    fail('.env.example parece conter uma DATABASE_URL real.');
  }
  for (const entry of ['EMAIL_MODE=mock', 'SMTP_HOST=', 'SMTP_PORT=', 'SMTP_SECURE=false', 'SMTP_USER=', 'SMTP_PASS=', 'SMTP_FROM=']) {
    if (!envExample.includes(entry)) fail(`.env.example nao contem: ${entry}`);
  }
}

if (fs.existsSync(path.join(ROOT, 'manifest.json'))) {
  const manifest = JSON.parse(read('manifest.json'));
  if (manifest.display !== 'standalone') fail('manifest.json precisa usar display standalone.');
  if (!manifest.start_url || !manifest.scope || !manifest.theme_color || !manifest.background_color) {
    fail('manifest.json esta incompleto para PWA.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('manifest.json precisa declarar icones PWA.');
  for (const icon of manifest.icons || []) {
    const iconPath = String(icon.src || '').replace(/^\/+/, '');
    if (!fs.existsSync(path.join(ROOT, iconPath))) fail(`Icone PWA nao encontrado: ${icon.src}`);
  }
}

if (fs.existsSync(path.join(ROOT, 'service-worker.js'))) {
  const sw = read('service-worker.js');
  if (!sw.includes("url.pathname.startsWith('/api/')")) fail('service-worker.js precisa tratar chamadas da API separadamente.');
  if (/cache\.put\(request/.test(sw) && !sw.includes("url.pathname.startsWith('/api/')")) {
    fail('service-worker.js pode estar cacheando requisicoes privadas.');
  }
}

for (const htmlFile of ['adminsigac.html', 'coordenador.html']) {
  const html = read(htmlFile);
  if (/cdn\.jsdelivr\.net\/npm\/chart\.js/i.test(html)) fail(`${htmlFile} ainda carrega Chart.js via CDN.`);
  if (!html.includes('vendor/chart.umd.min.js')) fail(`${htmlFile} precisa carregar Chart.js local.`);
}

const docsText = ['README.md', 'README-envio.txt', 'docs/entrega-1.md', 'docs/arquitetura.md']
  .filter((file) => fs.existsSync(path.join(ROOT, file)))
  .map(read)
  .join('\n');
if (!docsText.includes('fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend')) {
  fail('Documentacao precisa padronizar a descricao de e-mails simulados.');
}

const gitTrackedEnv = spawnSync('git', ['ls-files', '.env'], { cwd: ROOT, encoding: 'utf8' });
if (gitTrackedEnv.status === 0 && gitTrackedEnv.stdout.trim()) fail('.env esta rastreado pelo Git.');

const packageZip = path.join(ROOT, 'SIGAC-envio.zip');
if (fs.existsSync(packageZip)) {
  const list = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[System.IO.Compression.ZipFile]::OpenRead('${packageZip.replace(/'/g, "''")}'); try { $zip.Entries.FullName -join "` + '`n' + `" } finally { $zip.Dispose() }`
  ], { encoding: 'utf8' });
  if (list.status !== 0) fail('Nao foi possivel inspecionar SIGAC-envio.zip.');
  const entries = list.stdout.split(/\r?\n/).filter(Boolean);
  for (const entry of entries) {
    const normalizedEntry = entry.replace(/\\/g, '/');
    if (forbiddenZipEntries.some((blocked) => {
      const normalizedBlocked = blocked.replace(/\\/g, '/');
      if (normalizedBlocked.endsWith('/')) return normalizedEntry.startsWith(normalizedBlocked);
      return normalizedEntry === normalizedBlocked;
    })) {
      fail(`SIGAC-envio.zip contem item bloqueado: ${entry}`);
    }
    if (/\.log$|\.sqlite(?:-|$)|\.db$|\.session$|\.sess$|\.tmp$|\.bak$/i.test(normalizedEntry)) fail(`SIGAC-envio.zip contem arquivo temporario/local: ${entry}`);
  }
}

for (const file of ['server.js', 'db.js', 'js/data.js', 'js/login.js', 'js/index.js', 'js/admin.js', 'js/coordenador.js', 'js/ocr.js', 'js/pwa.js', 'service-worker.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`Erro de sintaxe em ${file}: ${result.stderr || result.stdout}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[SIGAC Entrega 1] Validacao basica concluida com sucesso.');
