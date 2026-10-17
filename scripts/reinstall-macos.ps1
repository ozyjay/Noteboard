param(
    [string]$SigningIdentity = $env:NOTEBOARD_SIGNING_IDENTITY,
    [string]$ProvisioningProfile = $env:NOTEBOARD_PROVISIONING_PROFILE
)

$ErrorActionPreference = 'Stop'
if (-not $IsMacOS) { throw 'This command requires macOS.' }

# Quit Noteboard before running. Build successfully before replacing the app.
& (Join-Path $PSScriptRoot 'package-macos.ps1') -SigningIdentity $SigningIdentity -ProvisioningProfile $ProvisioningProfile
if (-not $?) { throw 'Packaging failed; the installed app has not been changed.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$appPath = Join-Path $HOME 'Applications/Noteboard.app'
if (Test-Path $appPath) {
    Remove-Item $appPath -Recurse -Force
}
New-Item -ItemType Directory -Force (Split-Path $appPath -Parent) | Out-Null
& /usr/bin/ditto (Join-Path $projectRoot 'release/Noteboard.app') $appPath
if ($LASTEXITCODE -ne 0) { throw 'App installation failed.' }
& /usr/bin/codesign --verify --deep --strict $appPath
if ($LASTEXITCODE -ne 0) { throw 'Installed app signature verification failed.' }
Write-Output "Installed $appPath"
& /usr/bin/open $appPath
if ($LASTEXITCODE -ne 0) { throw 'App installed, but could not be opened.' }
