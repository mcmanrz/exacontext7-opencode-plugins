#Requires -Version 5.1
param(
    [switch]$Uninstall,
    [switch]$DryRun,
    [switch]$Help,
    [string]$ExaKeys,
    [string]$Context7Keys
)

$PKG = "exacontext7-opencode-plugins"

if ($Help) {
    Write-Host "Usage: install.ps1 [-Uninstall] [-DryRun] [-Help]"
    Write-Host "       [-ExaKeys key1,key2] [-Context7Keys key3]"
    Write-Host ""
    Write-Host "Installs or removes exacontext7-opencode-plugins from your global"
    Write-Host "opencode config ($env:APPDATA\opencode\opencode.jsonc)."
    Write-Host ""
    Write-Host "Each service supports round-robin rotation across multiple API keys"
    Write-Host "via KeyPool. Separate scopes prevent cross-service key contamination."
    exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if ($Uninstall) {
    Write-Host "[+] Uninstalling $PKG ..." -ForegroundColor Green
} else {
    Write-Host "[+] Installing $PKG ..." -ForegroundColor Green
}

Write-Host "[+] Installing npm package globally ..." -ForegroundColor Green
npm install -g $PKG 2>&1 | Select-Object -Last 1

Write-Host "[+] Updating opencode global config ..." -ForegroundColor Green

$mode = if ($Uninstall) { "--uninstall" } else { "--install" }
$dry = if ($DryRun) { "--dry-run" } else { "" }
$exaFlag = if ($ExaKeys) { @("--exa-keys", $ExaKeys) } else { @() }
$ctx7Flag = if ($Context7Keys) { @("--context7-keys", $Context7Keys) } else { @() }
$allArgs = @($mode, $dry) + $exaFlag + $ctx7Flag | Where-Object { $_ -ne "" }
$cmd = "require('$PKG/dist/install.js')"
node -e $cmd @allArgs

Write-Host "[+] Done! Plugin '$PKG' is now configured." -ForegroundColor Green
Write-Host "[+] Your Exa and Context7 tools will load on next opencode restart." -ForegroundColor Green
