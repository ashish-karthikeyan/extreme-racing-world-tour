# Builds the upload zip for itch.io and CrazyGames: release/extreme-racer-v<version>.zip
# Run it from the extreme-racer folder in PowerShell:   powershell -ExecutionPolicy Bypass -File tools\build-release.ps1
# It copies only what the game needs into release/build/ (index.html at the top), zips that with Windows' own tar
# (forward slashes inside the zip, which web hosts expect), and checks the size and file count against the portals' limits.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# the version comes from js/data/config.js (const VERSION = "1.0.0"), shortened to v1.0 for 1.0.0
$full = [regex]::Match((Get-Content js\data\config.js -Raw), 'const VERSION = "([^"]+)"').Groups[1].Value
$short = ($full -replace '\.0$', '')
$zip = Join-Path $root "release\extreme-racer-v$short.zip"
$build = Join-Path $root "release\build"

# 1. a clean copy of the game: only these files and folders (no .git, .claude, docs, tools, screenshots, notes)
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory $build -Force | Out-Null
Copy-Item index.html, CREDITS.md $build
foreach ($d in "css", "js", "lib", "assets") { Copy-Item $d (Join-Path $build $d) -Recurse }

# 2. the zip, with index.html at the top level (tar -a picks the zip format from the .zip ending)
if (Test-Path $zip) { Remove-Item $zip -Force }
& "$env:WINDIR\System32\tar.exe" -a -c -f $zip -C $build *
if ($LASTEXITCODE -ne 0) { throw "tar failed" }

# 3. the numbers the portals care about
$files = Get-ChildItem $build -Recurse -File
$dirs = (Get-ChildItem $build -Recurse -Directory).Count
$unpacked = ($files | Measure-Object Length -Sum).Sum / 1MB
$packed = (Get-Item $zip).Length / 1MB
$longest = ($files | ForEach-Object { $_.FullName.Substring($build.Length + 1).Length } | Measure-Object -Maximum).Maximum
$biggest = ($files | Measure-Object Length -Maximum).Maximum / 1MB
""
"Built $zip (version $full)"
"  zip: {0:N1} MB   unpacked: {1:N1} MB   files: {2}   folders: {3}   biggest file: {4:N1} MB   longest path: {5} characters" -f $packed, $unpacked, $files.Count, $dirs, $biggest, $longest
""
function Check($name, $ok) { "  [{0}] {1}" -f $(if ($ok) { "OK  " } else { "OVER" }), $name }
Check "CrazyGames: first download 50 MB or less (without their SDK they count the whole game)" ($unpacked -le 50)
Check "CrazyGames: 1,500 files or fewer" ($files.Count -le 1500)
Check "CrazyGames: mobile homepage wants 20 MB or less (optional)" ($unpacked -le 20)
Check "itch.io: 1,000 files or fewer (folders may count too)" (($files.Count + $dirs) -le 1000)
Check "itch.io: 500 MB unpacked, 200 MB per file, 240-character paths" (($unpacked -le 500) -and ($biggest -le 200) -and ($longest -le 240))
Check "This project's own rule: first download under 40 MB" ($unpacked -le 40)
