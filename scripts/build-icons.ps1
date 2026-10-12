$ErrorActionPreference = 'Stop'
if (-not $IsMacOS) { throw 'Icon generation requires macOS sips and iconutil.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $projectRoot 'assets/branding/noteboard-icon-master.png'
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) "noteboard-icons-$([guid]::NewGuid())"
$iconset = Join-Path $temporary 'Noteboard.iconset'
try {
    New-Item -ItemType Directory -Force $iconset | Out-Null
    foreach ($size in @(16, 32, 128, 256, 512)) {
        foreach ($scale in @(1, 2)) {
            $pixels = $size * $scale
            $suffix = if ($scale -eq 2) { '@2x' } else { '' }
            $output = Join-Path $iconset "icon_$($size)x$($size)$suffix.png"
            & /usr/bin/sips -z $pixels $pixels $source --out $output | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Failed to generate $output." }
        }
    }
    & /usr/bin/iconutil -c icns $iconset -o (Join-Path $projectRoot 'assets/branding/Noteboard.icns')
    if ($LASTEXITCODE -ne 0) { throw 'ICNS conversion failed.' }
    foreach ($entry in @{ 'noteboard-icon.png' = 512; 'favicon.png' = 32 }.GetEnumerator()) {
        & /usr/bin/sips -z $entry.Value $entry.Value $source --out (Join-Path $projectRoot "public/$($entry.Key)") | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to generate $($entry.Key)." }
    }
    Write-Output 'Generated macOS, Dock and browser icons.'
} finally {
    if (Test-Path $temporary) { Remove-Item $temporary -Recurse -Force }
}
