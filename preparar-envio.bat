@echo off
setlocal
set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = [System.IO.Path]::GetFullPath('%ROOT%');" ^
  "$zip = Join-Path $root 'SIGAC-envio.zip';" ^
  "$stage = Join-Path $env:TEMP ('SIGAC-envio-' + [guid]::NewGuid().ToString('N'));" ^
  "$excludeDirs = @('.git','node_modules','data','exports','.sixth','tools','tmp','temp');" ^
  "$excludeFileNames = @('.env','SIGAC-envio.zip','AGENTS.md','RELATORIO_OCR_BUGS_E_PENDENCIAS.md','migrate-to-remote.ps1');" ^
  "$excludePatterns = @('*.log','*.tmp','*.bak','*.sqlite','*.sqlite-*','*.db','*.session','*.sess','*.rar','node.exe');" ^
  "New-Item -ItemType Directory -Path $stage | Out-Null;" ^
  "Get-ChildItem -LiteralPath $root -Force | Where-Object { $name = $_.Name; if ($_.PSIsContainer) { -not ($excludeDirs -contains $name) } else { -not ($excludeFileNames -contains $name) -and -not ($excludePatterns | Where-Object { $name -like $_ }) } } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force };" ^
  "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force };" ^
  "Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force;" ^
  "$blocked = @('.env','.git/','node_modules/','data/','exports/','.sixth/') ;" ^
  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "$archive = [System.IO.Compression.ZipFile]::OpenRead($zip);" ^
  "try { $entries = $archive.Entries.FullName; $bad = $entries | Where-Object { $_ -eq '.env' -or $_ -like '.git/*' -or $_ -like 'node_modules/*' -or $_ -like 'data/*' -or $_ -like 'exports/*' -or $_ -like '.sixth/*' -or $_ -like '*.log' -or $_ -like '*.sqlite' -or $_ -like '*.sqlite-*' -or $_ -like '*.db' -or $_ -like '*.session' -or $_ -like '*.sess' }; if ($bad) { throw ('ZIP contem itens bloqueados: ' + ($bad -join ', ')) } } finally { $archive.Dispose() };" ^
  "Remove-Item -LiteralPath $stage -Recurse -Force;" ^
  "Write-Host 'Pacote gerado com sucesso:' $zip;"

if errorlevel 1 (
  echo Falha ao gerar SIGAC-envio.zip.
  exit /b 1
)

echo SIGAC-envio.zip pronto para envio.
endlocal
