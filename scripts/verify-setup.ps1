# verify-setup.ps1 — thin wrapper for Windows developers
# Canonical implementation lives in verify-setup.sh (runs on Linux/macOS and CI).
# Requires: pwsh (PowerShell 7+) or Git Bash / WSL.

<#
.SYNOPSIS
  Verify the Scavngr project setup by delegating to the canonical Bash script.

.DESCRIPTION
  The single source-of-truth for setup verification is scripts/verify-setup.sh.
  This wrapper locates that script and executes it with the system shell so that
  Windows developers get identical behaviour to CI (Linux).

  Prerequisites:
    - PowerShell 7+ (pwsh)
    - One of: WSL, Git-for-Windows bash, or another sh-compatible shell in PATH

.EXAMPLE
  .\scripts\verify-setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScript = Join-Path $scriptDir 'verify-setup.sh'

if (-not (Test-Path $bashScript)) {
    Write-Error "Cannot find canonical script: $bashScript"
    exit 1
}

# Prefer explicit shells in order: wsl bash > git-bash > sh in PATH
$shell = $null
foreach ($candidate in @('wsl', 'bash', 'sh')) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $shell = $candidate
        break
    }
}

if ($null -eq $shell) {
    Write-Error "No compatible shell found. Install WSL, Git-for-Windows, or add bash/sh to PATH."
    exit 1
}

Write-Host "Using shell: $shell" -ForegroundColor Cyan
Write-Host "Running: $bashScript" -ForegroundColor Cyan
Write-Host ""

if ($shell -eq 'wsl') {
    # Convert Windows path to WSL path
    $wslPath = wsl wslpath -a $bashScript.Replace('\', '/')
    & wsl bash $wslPath
} else {
    & $shell $bashScript
}

exit $LASTEXITCODE
