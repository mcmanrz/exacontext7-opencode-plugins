#Requires -Version 5.1
# Build standalone Windows installer (.exe) via Bun compile

Write-Host "Building standalone Windows installer (.exe) via Bun compile..." -ForegroundColor Green

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Bun is required for .exe compilation. Install from https://bun.sh" -ForegroundColor Red
    exit 1
}

bun build --compile --target=bun-windows-x64 src/install.ts --outfile dist/install.exe
$size = (Get-Item dist/install.exe).Length / 1MB
Write-Host "Done: dist/install.exe ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
