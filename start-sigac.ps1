
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$pgCtl = Join-Path $root 'tools\pgsql\bin\pg_ctl.exe'
$pgIsReady = Join-Path $root 'tools\pgsql\bin\pg_isready.exe'
$localNode = Join-Path $root 'node-v25.9.0-win-x64\node.exe'
$node = if (Test-Path $localNode) {
  $localNode
} else {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    throw 'Node.js nao encontrado. Instale o Node.js e rode npm install antes de iniciar.'
  }
  $nodeCommand.Source
}
$dataDir = Join-Path $root '.postgres-data'
$logFile = Join-Path $root 'postgres.log'
$envFile = Join-Path $root '.env'

if (-not (Test-Path $envFile)) { throw 'Arquivo .env nao encontrado.' }

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  throw 'Dependencias nao encontradas. Execute npm install nesta pasta antes de iniciar.'
}

$databaseUrlLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseUrlLine) { throw 'DATABASE_URL nao encontrado no .env.' }

$databaseUrl = $databaseUrlLine.Substring('DATABASE_URL='.Length)
$dbUri = [System.Uri]$databaseUrl
$isLocalDb = $dbUri.Host -in @('127.0.0.1', 'localhost', '::1')

if ($isLocalDb) {
  if (-not (Test-Path $pgCtl)) { throw 'PostgreSQL portatil nao encontrado.' }
  & $pgCtl -D $dataDir status *> $null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $dataDir -l $logFile start | Out-Null
    Start-Sleep -Seconds 3
  }
  & $pgIsReady -h $dbUri.Host -p $dbUri.Port | Write-Output
}

& $node server.js
*/