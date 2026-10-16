param(
    [switch]$Install,
    [string]$SigningIdentity = $env:NOTEBOARD_SIGNING_IDENTITY,
    [string]$ProvisioningProfile = $env:NOTEBOARD_PROVISIONING_PROFILE
)

$ErrorActionPreference = 'Stop'
if (-not $IsMacOS) { throw 'This command requires macOS.' }
if ([string]::IsNullOrWhiteSpace($SigningIdentity) -or $SigningIdentity -eq '-' -or
    [string]::IsNullOrWhiteSpace($ProvisioningProfile)) {
    throw 'Touch ID storage requires NOTEBOARD_SIGNING_IDENTITY and NOTEBOARD_PROVISIONING_PROFILE. Configure a macOS profile for app.noteboard.desktop with Keychain Sharing in Xcode; see docs/development.md. The installed app has not been changed.'
}
$ProvisioningProfile = (Resolve-Path $ProvisioningProfile).Path
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $signingRoot = Join-Path $projectRoot 'release/signing'
    New-Item -ItemType Directory -Force $signingRoot | Out-Null
    $decodedProfile = Join-Path $signingRoot 'profile.plist'
    & /usr/bin/security cms -D -i $ProvisioningProfile -o $decodedProfile
    if ($LASTEXITCODE -ne 0) { throw 'Could not decode the provisioning profile.' }
    # Profiles contain dates and certificate data, which plutil cannot convert to JSON.
    $profile = [System.Xml.XmlDocument]::new()
    $profile.XmlResolver = $null
    $profile.Load($decodedProfile)
    Remove-Item $decodedProfile
    $profileDict = $profile.plist.dict
    $expires = $profileDict.SelectSingleNode("key[.='ExpirationDate']/following-sibling::*[1]").InnerText
    if ([DateTimeOffset]::Parse($expires) -le [DateTimeOffset]::UtcNow) { throw 'The provisioning profile has expired.' }
    $platforms = @($profileDict.SelectNodes("key[.='Platform']/following-sibling::*[1]/string") | ForEach-Object { $_.InnerText })
    if ('OSX' -notin $platforms) { throw 'A macOS provisioning profile is required.' }
    $teamId = $profileDict.SelectSingleNode("key[.='TeamIdentifier']/following-sibling::*[1]/string[1]").InnerText
    $prefix = $profileDict.SelectSingleNode("key[.='ApplicationIdentifierPrefix']/following-sibling::*[1]/string[1]").InnerText
    $appIdentifier = "$prefix.app.noteboard.desktop"
    $profileEntitlements = $profileDict.SelectSingleNode("key[.='Entitlements']/following-sibling::dict[1]")
    $allowedIdentifier = $profileEntitlements.SelectSingleNode("key[.='com.apple.application-identifier']/following-sibling::*[1]").InnerText
    $allowedGroups = @($profileEntitlements.SelectNodes("key[.='keychain-access-groups']/following-sibling::*[1]/string") | ForEach-Object { $_.InnerText })
    if ($teamId -cnotmatch '^[A-Z0-9]{10}$' -or $prefix -cnotmatch '^[A-Z0-9]{10}$' -or
        -not $allowedIdentifier -or $appIdentifier -notlike $allowedIdentifier -or
        -not ($allowedGroups | Where-Object { $appIdentifier -like $_ })) {
        throw 'The profile must authorise app.noteboard.desktop and its Keychain access group.'
    }
    # Match the selected local identity to a certificate authorised by the profile.
    $identities = & /usr/bin/security find-identity -v -p codesigning
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect signing identities.' }
    $selected = @($identities | Where-Object { $_.Contains($SigningIdentity, [StringComparison]::OrdinalIgnoreCase) -and $_ -match '\b[0-9A-F]{40}\b' })
    if ($selected.Count -ne 1) { throw 'SigningIdentity must identify exactly one valid local code-signing identity.' }
    $fingerprint = [regex]::Match($selected[0], '\b[0-9A-F]{40}\b').Value
    $profileCertificates = @($profileDict.SelectNodes("key[.='DeveloperCertificates']/following-sibling::*[1]/data") | ForEach-Object {
        $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String($_.InnerText))
        try { $certificate.Thumbprint } finally { $certificate.Dispose() }
    })
    if ($fingerprint -notin $profileCertificates) { throw 'The selected signing certificate is not authorised by this provisioning profile.' }
    $entitlements = Join-Path $signingRoot 'noteboard.entitlements.plist'
    @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.application-identifier</key><string>$appIdentifier</string>
<key>com.apple.developer.team-identifier</key><string>$teamId</string>
<key>keychain-access-groups</key><array><string>$appIdentifier</string></array>
</dict></plist>
"@ | Set-Content $entitlements
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    $bundle = Join-Path $projectRoot 'release/Noteboard.app'
    if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force }
    New-Item -ItemType Directory -Force (Split-Path $bundle -Parent) | Out-Null
    & /usr/bin/ditto 'node_modules/electron/dist/Electron.app' $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Electron bundle copy failed.' }
    $resources = Join-Path $bundle 'Contents/Resources'
    Copy-Item 'assets/branding/Noteboard.icns' (Join-Path $resources 'Noteboard.icns')
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
        CFBundleIconFile = 'Noteboard.icns'
        CFBundleShortVersionString = $package.version
        CFBundleVersion = $package.version
    }.GetEnumerator()) {
        & /usr/libexec/PlistBuddy -c "Set :$($entry.Key) $($entry.Value)" $plist
        if ($LASTEXITCODE -ne 0) { throw "Failed to set $($entry.Key)." }
    }
    Copy-Item $ProvisioningProfile (Join-Path $bundle 'Contents/embedded.provisionprofile')
    & /usr/bin/codesign --force --sign $fingerprint (Join-Path $appRoot 'dist-electron/noteboard-keychain.node')
    if ($LASTEXITCODE -ne 0) { throw 'Native Keychain module signing failed.' }
    # First sign nested code without credential entitlements; grant those only to main.
    & /usr/bin/codesign --force --deep --sign $fingerprint $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Local app signing failed.' }
    & /usr/bin/codesign --force --sign $fingerprint --entitlements $entitlements $bundle
    if ($LASTEXITCODE -ne 0) { throw 'App entitlement signing failed.' }
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
