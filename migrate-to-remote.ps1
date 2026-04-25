param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteDatabaseUrl
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$envFile = Join-Path $root '.env'
$envBackup = Join-Path $root ".env.backup.$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
$pgCtl = Join-Path $root 'tools\pgsql\bin\pg_ctl.exe'
$pgIsReady = Join-Path $root 'tools\pgsql\bin\pg_isready.exe'
$pgDump = Join-Path $root 'tools\pgsql\bin\pg_dump.exe'
$psql = Join-Path $root 'tools\pgsql\bin\psql.exe'
$dumpDir = Join-Path $root 'backups'
$dumpFile = Join-Path $dumpDir "sigac-remote-migration-$((Get-Date).ToString('yyyyMMdd-HHmmss')).sql"

if (-not (Test-Path $envFile)) { throw 'Arquivo .env não encontrado.' }
if (-not (Test-Path $pgDump)) { throw 'pg_dump não encontrado em tools\pgsql\bin.' }
if (-not (Test-Path $psql)) { throw 'psql não encontrado em tools\pgsql\bin.' }

$currentEnv = Get-Content $envFile
$databaseUrlLine = $currentEnv | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseUrlLine) { throw 'DATABASE_URL não encontrado no .env.' }

$localDatabaseUrl = $databaseUrlLine.Substring('DATABASE_URL='.Length)
$localUri = [System.Uri]$localDatabaseUrl

if ($localUri.Host -notin @('127.0.0.1', 'localhost', '::1')) {
  throw "O .env atual já não está apontando para um banco local: $($localUri.Host)"
}

if (-not (Test-Path $pgCtl)) { throw 'PostgreSQL portátil local não encontrado.' }

& $pgCtl -D '.\.postgres-data' status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D '.\.postgres-data' -l '.\postgres.log' start | Out-Null
  Start-Sleep -Seconds 3
}

& $pgIsReady -h $localUri.Host -p $localUri.Port | Write-Output

New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null
Copy-Item $envFile $envBackup -Force

$localBuilder = [System.UriBuilder]$localDatabaseUrl
$localPassword = [System.Uri]::UnescapeDataString($localBuilder.Password)
$localUser = [System.Uri]::UnescapeDataString($localBuilder.UserName)
$localDb = $localUri.AbsolutePath.TrimStart('/')

$remoteBuilder = [System.UriBuilder]$RemoteDatabaseUrl
$remotePassword = [System.Uri]::UnescapeDataString($remoteBuilder.Password)
$remoteUser = [System.Uri]::UnescapeDataString($remoteBuilder.UserName)
$remoteDb = $remoteBuilder.Path.TrimStart('/')

Write-Output "Gerando dump local em $dumpFile"
$env:PGPASSWORD = $localPassword
& $pgDump `
  --host $localUri.Host `
  --port $localUri.Port `
  --username $localUser `
  --dbname $localDb `
  --clean `
  --if-exists `
  --no-owner `
  --no-privileges `
  --encoding UTF8 `
  --file $dumpFile

if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o dump local.' }

Write-Output 'Testando conexão com o banco remoto'
$env:PGPASSWORD = $remotePassword
& $psql $RemoteDatabaseUrl -v ON_ERROR_STOP=1 -tAc 'SELECT current_database()'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao conectar ao banco remoto.' }

Write-Output "Importando dump no banco remoto $remoteDb"
& $psql $RemoteDatabaseUrl -v ON_ERROR_STOP=1 -f $dumpFile
if ($LASTEXITCODE -ne 0) { throw 'Falha ao importar o dump no banco remoto.' }

$updatedEnv = foreach ($line in $currentEnv) {
  if ($line -match '^DATABASE_URL=') {
    "DATABASE_URL=$RemoteDatabaseUrl"
  } else {
    $line
  }
}
$updatedEnv | Set-Content $envFile

Write-Output "Migração concluída. Backup do .env salvo em $envBackup"
Write-Output 'O projeto agora aponta para o banco remoto.'
