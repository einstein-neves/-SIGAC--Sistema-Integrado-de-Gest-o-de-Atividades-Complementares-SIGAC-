$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$pgCtl = Join-Path $root 'tools\pgsql\bin\pg_ctl.exe'
$dataDir = Join-Path $root '.postgres-data'

Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*server.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

if (Test-Path $pgCtl) {
  & $pgCtl -D $dataDir stop -m fast | Out-Null
}
