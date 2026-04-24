# build_installer.ps1
# Run this script to package your project into a Windows installer.
# Usage: .\build_installer.ps1 -SourceDir ".\my-project" -AppName "MyApp"

param(
    [Parameter(Mandatory=$false)]
    [string]$SourceDir = "app_backend",

    [Parameter(Mandatory=$false)]
    [string]$AppName = "dof-pdf",

    [string]$OutputFile = "Install-$AppName-server.ps1"
)

# ── Validate source ──────────────────────────────────────────────────────────
if (-not (Test-Path $SourceDir)) {
    Write-Error "Source directory '$SourceDir' not found."
    exit 1
}

# ── File routing rules ───────────────────────────────────────────────────────
# Edit these patterns to control which files go where.
#
#   "Documents\<AppName>"  → user data, configs, scripts the user may edit
#   "Program Files\<AppName>" → application binaries / compose / api module
#
$programFilesPatterns = @(
    "docker-compose*.yml",
    "src\*.py", # Source API module
    "Dockerfile*",
    "requirements*.txt",
    ".env"
)

$documentsPatterns = @(
    "volumes\data\configs\*",
    "volumes\data\lnav\*",
    "README.md",
    "*.ps1"
)

function Get-Destination($relativePath) {
    $file = Split-Path $relativePath -Leaf
    foreach ($pat in $programFilesPatterns) {
        if ($file -like $pat -or $relativePath -like $pat) {
            return "ProgramFiles"
        }
    }
    foreach ($pat in $documentsPatterns) {
        if ($file -like $pat -or $relativePath -like $pat) {
            return "Documents"
        }
    }
    # Skip files that don't match any pattern
    return $null
}

# ── Collect & encode files ────────────────────────────────────────────────────
Write-Host "Scanning '$SourceDir'..." -ForegroundColor Cyan

$fileEntries = @()
Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path $SourceDir).Path.Length).TrimStart('\','/')
    $dest = Get-Destination $rel
    if (-not $dest) { return }
    $b64  = [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName))
    $fileEntries += [PSCustomObject]@{
        RelPath = $rel
        Dest    = $dest
        Data    = $b64
    }
    Write-Host "  [$dest] $rel"
}

Write-Host "`nTotal files: $($fileEntries.Count)" -ForegroundColor Green

# ── Serialize file table as embedded JSON ─────────────────────────────────────
$jsonPayload = $fileEntries | ConvertTo-Json -Depth 5 -Compress
$payloadB64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($jsonPayload))

# ── Generate the installer script ─────────────────────────────────────────────
$installerScript = @"
#Requires -Version 5.1
<#
.SYNOPSIS
    Installer for $AppName
.DESCRIPTION
    Extracts application files and starts Docker Compose services.
    Must be run as Administrator.
#>

Set-StrictMode -Version Latest
`$ErrorActionPreference = 'Stop'

try {

# ── Privilege check ───────────────────────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
          ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Restarting as Administrator..."
    Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File `"`$PSCommandPath`"" -Verb RunAs
    exit
}

`$AppName      = "$AppName"
`$ProgFilesDir = Join-Path `$Env:ProgramFiles `$AppName
`$DocsDir      = Join-Path ([Environment]::GetFolderPath('MyDocuments')) `$AppName

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Installing `$AppName" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Program Files : `$ProgFilesDir"
Write-Host "  Documents     : `$DocsDir"
Write-Host ""

# ── Create destination dirs ───────────────────────────────────────────────────
foreach (`$dir in @(`$ProgFilesDir, `$DocsDir)) {
    if (-not (Test-Path `$dir)) {
        New-Item -ItemType Directory -Path `$dir -Force | Out-Null
        Write-Host "Created: `$dir" -ForegroundColor DarkGray
    }
}

# Create logs dir in Documents
`$logsDir = Join-Path `$DocsDir "volumes\data\logs"
if (-not (Test-Path `$logsDir)) {
    New-Item -ItemType Directory -Path `$logsDir -Force | Out-Null
    Write-Host "Created: `$logsDir" -ForegroundColor DarkGray
}

# ── Decode embedded payload ───────────────────────────────────────────────────
`$payloadB64 = "$payloadB64"
`$json       = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(`$payloadB64))
`$files      = `$json | ConvertFrom-Json

`$composeDir = `$null

# ── Extract files ─────────────────────────────────────────────────────────────
foreach (`$entry in `$files) {
    `$baseDir = if (`$entry.Dest -eq 'Documents') { `$DocsDir } else { `$ProgFilesDir }
    `$target  = Join-Path `$baseDir `$entry.RelPath
    `$parent  = Split-Path `$target -Parent

    if (-not (Test-Path `$parent)) {
        New-Item -ItemType Directory -Path `$parent -Force | Out-Null
    }

    [IO.File]::WriteAllBytes(`$target, [Convert]::FromBase64String(`$entry.Data))
    Write-Host "  Extracted: `$(`$entry.Dest)\`$(`$entry.RelPath)" -ForegroundColor Gray

    # Track where docker-compose lives
    if (`$entry.RelPath -match 'docker-compose.*\.(yml|yaml)$' -and `$composeDir -eq `$null) {
        `$composeDir = `$parent
    }
}

Write-Host ""
Write-Host "All files extracted." -ForegroundColor Green

# ── Docker / Docker Compose check ─────────────────────────────────────────────
Write-Host ""
Write-Host "Checking Docker..." -ForegroundColor Cyan

`$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not `$dockerCmd) {
    Write-Warning "Docker was not found in PATH."
    Write-Warning "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    Write-Warning "Then run:  docker compose up -d"
    Write-Warning "  from:    `$composeDir"
    Read-Host "Press Enter to exit"
    exit 1
}

# Docker Desktop on Windows may need a moment; verify the daemon is up
`$dockerInfo = & docker info 2>&1
if (`$LASTEXITCODE -ne 0) {
    Write-Warning "Docker daemon is not running. Please start Docker Desktop and re-run this installer, or run:"
    Write-Warning "  cd `"`$composeDir`""
    Write-Warning "  docker compose up -d"
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Run docker compose up -d ──────────────────────────────────────────────────
if (`$composeDir) {
    Write-Host ""
    Write-Host "Starting services with Docker Compose..." -ForegroundColor Cyan
    Write-Host "  Working dir: `$composeDir" -ForegroundColor DarkGray

    Push-Location `$composeDir
    try {
        & docker compose up --build -d
        if (`$LASTEXITCODE -ne 0) { throw "docker compose up -d failed (exit `$LASTEXITCODE)" }
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Services started successfully." -ForegroundColor Green
} else {
    Write-Warning "No docker-compose.yml found in extracted files. Skipping compose step."
}

# ── Add Program Files dir to system PATH (optional, silent) ──────────────────
`$currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if (`$currentPath -notlike "*`$ProgFilesDir*") {
    [Environment]::SetEnvironmentVariable('Path', "`$currentPath;`$ProgFilesDir", 'Machine')
    Write-Host "Added `$ProgFilesDir to system PATH." -ForegroundColor DarkGray
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  `$AppName installed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App files : `$ProgFilesDir"
Write-Host "  Config    : `$DocsDir"
Write-Host ""
Read-Host "Press Enter to exit"

} catch {
    Write-Host ""
    Write-Host "ERROR: `$_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
"@

# ── Write output ──────────────────────────────────────────────────────────────
$installerScript | Out-File -FilePath $OutputFile -Encoding UTF8

# $installerExe = $appName + "-server-installer.exe"
# ps2exe .\$OutputFile .\$installerExe -requireAdmin

Write-Host "`nInstaller written to: $OutputFile" -ForegroundColor Green
Write-Host ""
Write-Host "To distribute:" -ForegroundColor Yellow
Write-Host "  1. Send '$OutputFile' to the target machine"
Write-Host "  2. Right-click => 'Run with PowerShell'  (or run as Admin in a PS terminal)"
Write-Host ""
Write-Host "To allow execution if blocked by policy, the user can run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File $OutputFile"