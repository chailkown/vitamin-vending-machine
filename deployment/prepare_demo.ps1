param(
    [switch]$CheckOnly,
    [switch]$SkipInstall,
    [switch]$StartMobile,
    [ValidateRange(1,65535)][int]$MobilePort = 3001,
    [string]$PythonExecutable
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}

Push-Location $repo
try {
    $requiredTools=@('git','node'); if (-not $SkipInstall) { $requiredTools += 'npm.cmd' }
    foreach ($tool in $requiredTools) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. Install Git and Node.js 22.12+ LTS, then reopen this terminal." }
    }
    $nodeVersion = & node -p process.versions.node
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12+ is required.' }
    Write-Host "Node $nodeVersion"
    $python = $null
    $pythonPrefix = @()
    $pythonCandidates=@('py','python','python3'); if ($PythonExecutable) { $pythonCandidates=@($PythonExecutable) }
    foreach ($candidate in $pythonCandidates) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            $prefix = @(); if ($candidate -eq 'py') { $prefix = @('-3') }
            & $candidate @prefix -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { $python=$candidate; $pythonPrefix=$prefix; break }
        }
    }
    if (-not $python) { throw 'Python 3.10+ is required. Install Python and reopen this terminal.' }
    Invoke-Checked $python ($pythonPrefix + @('--version'))
    foreach ($app in @('frontend','health-app-web')) {
        if (-not (Test-Path "$app/package-lock.json")) { throw "Missing lockfile: $app" }
        if (-not (Test-Path "$app/.env")) { throw "Missing $app/.env. Restore the tracked public configuration; never insert a service-role key." }
    }
    # Validate only; do not print keys or full environment files.
    Invoke-Checked 'node' @('deployment/validate_public_env.cjs')
    Write-Host 'Public configuration and local prerequisites checked.'
    if ($CheckOnly) { return }
    foreach ($app in @('health-app-web','frontend')) {
        Push-Location $app
        try {
            if (-not $SkipInstall) {
                $installArgs=@('ci'); if ($app -eq 'frontend') { $installArgs += '--legacy-peer-deps' }
                Invoke-Checked 'npm.cmd' $installArgs
            }
            if (-not (Test-Path 'node_modules')) { throw "Missing dependencies in $app. Run without -SkipInstall." }
            if ($app -eq 'health-app-web') {
                Invoke-Checked 'node' @('node_modules/vite/bin/vite.js','build')
                Invoke-Checked 'node' @('node_modules/eslint/bin/eslint.js','.')
                Invoke-Checked 'node' @('--test','tests/integration.mjs','tests/inventory.mjs','tests/admin_service.mjs','tests/fan_settings.mjs')
            } else {
                Invoke-Checked 'node' @('node_modules/react-scripts/bin/react-scripts.js','build')
                $previousCI=$env:CI
                try { $env:CI='true'; Invoke-Checked 'node' @('node_modules/react-scripts/bin/react-scripts.js','test','--watchAll=false','--runInBand') }
                finally { $env:CI=$previousCI }
            }
        } finally { Pop-Location }
    }
    Invoke-Checked $python ($pythonPrefix + @('-m','unittest','discover','-s','pi_gateway','-p','test_*.py'))
    $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
    $output=Join-Path $repo ".deploy/demo-$stamp"
    Invoke-Checked $python ($pythonPrefix + @('deployment/package.py','--output',$output))
    $commit=(& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read Git revision.' }
    $dirty=([string](& git status --porcelain)).Length -gt 0
    @("commit=$commit", "working_tree_changes=$dirty", "prepared_at=$(Get-Date -Format o)", 'hardware_tested=false') | Set-Content -Encoding UTF8 (Join-Path $output 'BUILD_INFO.txt')
    Write-Host "Prepared bundle: $output"
    if ($StartMobile) {
        $stdout = Join-Path (Split-Path $output -Parent) "mobile-$stamp.stdout.log"
        $stderr = Join-Path (Split-Path $output -Parent) "mobile-$stamp.stderr.log"
        $arguments = $pythonPrefix + @('deployment/serve_mobile_lan.py', '--directory', 'health-app-web/dist', '--port', "$MobilePort")
        $server = Start-Process -FilePath (Get-Command $python).Source -ArgumentList $arguments -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        $verified = $false
        try {
            for ($attempt = 0; $attempt -lt 30; $attempt++) {
                $server.Refresh()
                if ($server.HasExited) { throw "Mobile server could not start. See $stderr" }
                if ((Get-Content -LiteralPath $stdout -Raw) -like "Mobile web port $MobilePort;*") {
                    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$MobilePort/" -TimeoutSec 3
                    if ($response.StatusCode -ne 200) { throw 'Mobile web did not return HTTP 200.' }
                    $verified = $true
                    break
                }
                Start-Sleep -Milliseconds 200
            }
            if (!$verified) { throw "Mobile startup timed out. See $stderr" }
        } finally {
            if (!$verified -and !$server.HasExited) { Stop-Process -Id $server.Id }
        }
        Write-Host "Mobile server PID $($server.Id) | HTTP 200 | $stdout"
        Write-Host "Phone URL: http://<laptop Wi-Fi IPv4>:$MobilePort/ (find IPv4 with ipconfig)"
    }
    Write-Host 'No hardware was contacted. Preserve the existing Pi device.json and calibrated motor timings.'
    if (!$StartMobile) {
        Write-Host 'Start mobile: python deployment/serve_mobile_lan.py --directory health-app-web/dist --port 3001 (or py -3).'
    }
    Write-Host 'Next: follow DEMO_START_HERE.md for Pi upload and the physical checklist.'
} finally { Pop-Location }
