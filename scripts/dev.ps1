$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location "$Root\backend"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& ".venv\Scripts\python.exe" -m pip install -e ".[dev]"
$Backend = Start-Process -PassThru -NoNewWindow ".venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--reload"

try {
    Set-Location "$Root\frontend"
    npm install
    npm run dev
}
finally {
    if ($Backend -and -not $Backend.HasExited) { Stop-Process -Id $Backend.Id }
}
