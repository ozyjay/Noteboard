param([switch]$Install)

$ErrorActionPreference = 'Stop'
if (-not $IsMacOS) { throw 'This command requires macOS.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    $bundle = Join-Path $projectRoot 'release/Noteboard.app'
    if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force }
    New-Item -ItemType Directory -Force (Split-Path $bundle -Parent) | Out-Null
    & /usr/bin/ditto 'node_modules/electron/dist/Electron.app' $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Electron bundle copy failed.' }
    $resources = Join-Path $bundle 'Contents/Resources'
    $appRoot = Join-Path $resources 'app'
    New-Item -ItemType Directory -Force $appRoot | Out-Null
    Copy-Item 'dist', 'dist-electron' $appRoot -Recurse
    $package = Get-Content 'package.json' -Raw | ConvertFrom-Json
    @{ name = 'inquiry'; productName = 'Noteboard'; version = $package.version; main = 'dist-electron/main.cjs' } |
        ConvertTo-Json | Set-Content (Join-Path $appRoot 'package.json')
    Copy-Item 'node_modules/electron/dist/LICENSE', 'node_modules/electron/dist/LICENSES.chromium.html' $resources
    $plist = Join-Path $bundle 'Contents/Info.plist'
    Rename-Item (Join-Path $bundle 'Contents/MacOS/Electron') 'Noteboard'
    foreach ($entry in @{
        CFBundleExecutable = 'Noteboard'
        CFBundleName = 'Noteboard'
        CFBundleDisplayName = 'Noteboard'
        CFBundleIdentifier = 'app.noteboard.desktop'
        CFBundleShortVersionString = $package.version
        CFBundleVersion = $package.version
    }.GetEnumerator()) {
        & /usr/libexec/PlistBuddy -c "Set :$($entry.Key) $($entry.Value)" $plist
        if ($LASTEXITCODE -ne 0) { throw "Failed to set $($entry.Key)." }
    }
    & /usr/bin/codesign --force --deep --sign - $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Local app signing failed.' }
    & /usr/bin/codesign --verify --deep --strict $bundle
    if ($LASTEXITCODE -ne 0) { throw 'App signature verification failed.' }
    Write-Output "Built $bundle"
    if ($Install) {
        $applications = Join-Path $HOME 'Applications'
        $destination = Join-Path $applications 'Noteboard.app'
        if (Test-Path $destination) { throw "An app already exists at $destination. Quit it and remove or move that bundle before reinstalling. Your saved data is stored separately." }
        New-Item -ItemType Directory -Force $applications | Out-Null
        & /usr/bin/ditto $bundle $destination
        if ($LASTEXITCODE -ne 0) { throw 'App installation failed.' }
        Write-Output "Installed $destination"
    }
} finally {
    Pop-Location
}
