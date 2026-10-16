param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Z0-9]{10}$')][string]$TeamId,
    [switch]$RegisterDevice
)

$ErrorActionPreference = 'Stop'
if (-not $IsMacOS) { throw 'This command requires macOS and Xcode.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$signingRoot = Join-Path $projectRoot 'release/signing-setup'
$project = Join-Path $signingRoot 'NoteboardSigning.xcodeproj'
New-Item -ItemType Directory -Force $project | Out-Null
# This disposable target asks Xcode to provision the real app identifier. It is
# never installed or run and contains no Noteboard data or credentials.
'int main(void) { return 0; }' | Set-Content (Join-Path $signingRoot 'main.c')
@'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>keychain-access-groups</key><array><string>$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)</string></array></dict></plist>
'@ | Set-Content (Join-Path $signingRoot 'Noteboard.entitlements')
@'
// !$*UTF8*$!
{
 archiveVersion = 1;
 classes = {};
 objectVersion = 56;
 objects = {
  100000000000000000000001 = {isa = PBXProject; buildConfigurationList = 100000000000000000000002; compatibilityVersion = "Xcode 14.0"; mainGroup = 100000000000000000000003; productRefGroup = 100000000000000000000004; projectDirPath = ""; projectRoot = ""; targets = (100000000000000000000005,);};
  100000000000000000000002 = {isa = XCConfigurationList; buildConfigurations = (100000000000000000000006,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug;};
  100000000000000000000003 = {isa = PBXGroup; children = (100000000000000000000007,100000000000000000000004,); sourceTree = "<group>";};
  100000000000000000000004 = {isa = PBXGroup; children = (100000000000000000000008,); name = Products; sourceTree = "<group>";};
  100000000000000000000005 = {isa = PBXNativeTarget; buildConfigurationList = 100000000000000000000009; buildPhases = (10000000000000000000000A,); buildRules = (); dependencies = (); name = NoteboardSigning; productName = NoteboardSigning; productReference = 100000000000000000000008; productType = "com.apple.product-type.application";};
  100000000000000000000006 = {isa = XCBuildConfiguration; buildSettings = {SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 12.0;}; name = Debug;};
  100000000000000000000007 = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.c; path = main.c; sourceTree = "<group>";};
  100000000000000000000008 = {isa = PBXFileReference; explicitFileType = wrapper.application; path = NoteboardSigning.app; sourceTree = BUILT_PRODUCTS_DIR;};
  100000000000000000000009 = {isa = XCConfigurationList; buildConfigurations = (10000000000000000000000B,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug;};
  10000000000000000000000A = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (10000000000000000000000C,); runOnlyForDeploymentPostprocessing = 0;};
  10000000000000000000000B = {isa = XCBuildConfiguration; buildSettings = {CODE_SIGN_ENTITLEMENTS = Noteboard.entitlements; CODE_SIGN_STYLE = Automatic; GENERATE_INFOPLIST_FILE = YES; PRODUCT_BUNDLE_IDENTIFIER = app.noteboard.desktop; PRODUCT_NAME = "$(TARGET_NAME)";}; name = Debug;};
  10000000000000000000000C = {isa = PBXBuildFile; fileRef = 100000000000000000000007;};
 };
 rootObject = 100000000000000000000001;
}
'@ | Set-Content (Join-Path $project 'project.pbxproj')

$derivedData = Join-Path $signingRoot 'DerivedData'
$buildArguments = @('-project', $project, '-scheme', 'NoteboardSigning', '-configuration', 'Debug', '-destination', 'platform=macOS', '-derivedDataPath', $derivedData, '-allowProvisioningUpdates', "DEVELOPMENT_TEAM=$TeamId", 'build')
if ($RegisterDevice) { $buildArguments += '-allowProvisioningDeviceRegistration' }
& /usr/bin/xcodebuild @buildArguments
if ($LASTEXITCODE -ne 0) { throw 'Xcode could not provision Noteboard. Check Xcode Settings > Accounts, then rerun this command. The installed app and credentials have not been changed.' }
$profile = Join-Path $derivedData 'Build/Products/Debug/NoteboardSigning.app/Contents/embedded.provisionprofile'
if (-not (Test-Path $profile)) { throw 'Xcode did not embed a provisioning profile for Keychain access.' }
Write-Output "Provisioning profile ready: $profile"
Write-Output 'Set NOTEBOARD_SIGNING_IDENTITY to your Apple Development signing identity and NOTEBOARD_PROVISIONING_PROFILE to this profile, then run npm run reinstall:macos.'
