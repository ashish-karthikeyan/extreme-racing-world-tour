param(
  [string]$Zip = (Join-Path (Split-Path $PSScriptRoot -Parent) 'release\extreme-racer-v1.0.zip')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Zip))
try {
  $entries = @($archive.Entries | Where-Object { $_.Name })
  $paths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  $folded = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $entries) {
    $path = $entry.FullName.Replace('\', '/')
    [void]$paths.Add($path)
    if (-not $folded.ContainsKey($path)) { $folded.Add($path, $path) }
  }

  $problems = [System.Collections.Generic.List[string]]::new()
  $referenced = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::Ordinal)
  $badExternal = [System.Collections.Generic.List[string]]::new()
  $absolute = [System.Collections.Generic.List[string]]::new()

  if (-not $paths.Contains('index.html')) { $problems.Add('index.html is not at the ZIP root.') }

  $rootText = @($entries | Where-Object { $_.FullName -match '\.(html|css|js|json)$' })
  foreach ($entry in $rootText) {
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $source = $entry.FullName.Replace('\', '/')

    $extension = [IO.Path]::GetExtension($source).ToLowerInvariant()
    $matches = @()
    if ($extension -eq '.html') { $matches += [regex]::Matches($content, '(?i)(?:src|href)\s*=\s*["'']([^"'']+)["'']') }
    if ($extension -eq '.css') { $matches += [regex]::Matches($content, '(?i)url\(\s*["'']?([^\s)"'']+)') }
    if ($extension -eq '.js') {
      $matches += [regex]::Matches($content, '(?s)\bimport\s+(?:[^;]*?\s+from\s*)?["'']([^"'']+)["'']')
      if ($source -like 'js/*') { $matches += [regex]::Matches($content, '["'']((?:assets/|\.{1,2}/)[^"'']+\.(?:glb|gltf|hdr|webp|png|jpe?g|ogg|mp3|wav|woff2?|json))(?:[?#][^"'']*)?["'']', 'IgnoreCase') }
      if ($source -like 'js/*') { $matches += [regex]::Matches($content, '["'']((?:https?://[^"'']+|/[^"'']+\.(?:glb|gltf|hdr|webp|png|jpe?g|ogg|mp3|wav|woff2?|json)(?:[?#][^"'']*)?))["'']', 'IgnoreCase') }
    }
    foreach ($m in $matches) {
      $raw = $m.Groups[1].Value
      if ($raw -match '^(data:|blob:|https://|mailto:|#)') { continue }
      if ($raw -match '^http://') { $badExternal.Add("$source -> $raw"); continue }
      if ($raw.StartsWith('/')) { $absolute.Add("$source -> $raw"); continue }
      if ($raw -match '\$\{|\{\*\}') { continue }
      $target = [Uri]::UnescapeDataString(($raw -split '[?#]')[0])
      if (-not $target) { continue }
      if ($raw.StartsWith('./') -or $raw.StartsWith('../')) {
        $parts = [System.Collections.Generic.List[string]]::new()
        $dir = [IO.Path]::GetDirectoryName($source).Replace('\', '/')
        if ($dir) { foreach ($part in $dir.Split('/')) { if ($part) { $parts.Add($part) } } }
        foreach ($part in $target.Split('/')) {
          if ($part -eq '..') { if ($parts.Count) { $parts.RemoveAt($parts.Count - 1) } }
          elseif ($part -and $part -ne '.') { $parts.Add($part) }
        }
        $target = $parts -join '/'
      }
      if ($raw -eq 'three') { $target = 'lib/three/three.module.min.js' }
      elseif ($raw.StartsWith('three/addons/')) { $target = 'lib/three/addons/' + $raw.Substring('three/addons/'.Length) }
      if ($target -match '\.[A-Za-z0-9]{1,8}$') { $referenced["$source -> $raw"] = $target }
    }

  }

  # Expand the game's runtime catalogs so generated model, sky, texture, and city
  # pack URLs are compared to the archive too.
  $catalog = [System.Collections.Generic.List[string]]::new()
  foreach ($entry in $entries) {
    $p = $entry.FullName.Replace('\', '/')
    if ($p -match '\.glb$') {
      $stream = $entry.Open(); $memory = [IO.MemoryStream]::new()
      try {
        $stream.CopyTo($memory); $bytes = $memory.ToArray()
        if ($bytes.Length -ge 20 -and [BitConverter]::ToInt32($bytes, 0) -eq 0x46546C67) {
          $chunkLength = [BitConverter]::ToInt32($bytes, 12)
          if ($chunkLength -gt 0 -and $chunkLength + 20 -le $bytes.Length -and [BitConverter]::ToUInt32($bytes, 16) -eq 0x4E4F534A) {
            $jsonText = [Text.Encoding]::UTF8.GetString($bytes, 20, $chunkLength).Trim([char]0, [char]32)
            $gltf = $jsonText | ConvertFrom-Json
            foreach ($asset in @($gltf.images) + @($gltf.buffers)) {
              $uri = $asset.uri
              if ($uri -and $uri -notmatch '^(?i)(data:|https?://|blob:)') {
                $uri = [Uri]::UnescapeDataString(($uri -split '[?#]')[0]).Replace('\', '/')
                $base = [IO.Path]::GetDirectoryName($p).Replace('\', '/')
                $parts = [System.Collections.Generic.List[string]]::new()
                foreach ($part in ($base + '/' + $uri).Split('/')) { if ($part -eq '..') { if ($parts.Count) { $parts.RemoveAt($parts.Count - 1) } } elseif ($part -and $part -ne '.') { $parts.Add($part) } }
                $expected = $parts -join '/'; $referenced["$p -> $($asset.uri)"] = $expected
              }
            }
          }
        }
      } finally { $stream.Dispose(); $memory.Dispose() }
    }
  }
  $assetsJs = $entries | Where-Object FullName -eq 'js/render3d/assets.js' | Select-Object -First 1
  if ($assetsJs) {
    $r = [IO.StreamReader]::new($assetsJs.Open()); try { $code = $r.ReadToEnd() } finally { $r.Dispose() }
    foreach ($m in [regex]::Matches($code, 'list\("([^"]+)"\s*,\s*\[([^\]]+)\]')) {
      $folder = $m.Groups[1].Value
      foreach ($n in [regex]::Matches($m.Groups[2].Value, '"([^"]+)"')) { $catalog.Add("assets/models/$folder/$($n.Groups[1].Value).glb") }
    }
  }
  $envJs = $entries | Where-Object FullName -eq 'js/render3d/env.js' | Select-Object -First 1
  if ($envJs) {
    $r = [IO.StreamReader]::new($envJs.Open()); try { $code = $r.ReadToEnd() } finally { $r.Dispose() }
    $tods = [regex]::Match($code, 'TODS\s*=\s*\[([^\]]+)\]')
    foreach ($n in [regex]::Matches($tods.Groups[1].Value, '"([^"]+)"|\b(morning|midday|sunset|night|overcast|clear|golden|dusk)\b')) {
      $sky = if ($n.Groups[1].Success) { $n.Groups[1].Value } else { $n.Groups[2].Value }
      if ($sky -notmatch '^golden[+-]$') { $catalog.Add("assets/hdri/$sky.hdr") }
    }
  }
  $packJs = $entries | Where-Object FullName -eq 'js/render3d/citypack.js' | Select-Object -First 1
  if ($packJs) {
    $r = [IO.StreamReader]::new($packJs.Open()); try { $code = $r.ReadToEnd() } finally { $r.Dispose() }
    $has = [regex]::Match($code, 'const HAS\s*=\s*new Set\(\[([^\]]+)\]')
    foreach ($m in [regex]::Matches($has.Groups[1].Value, '"([^"]+)"')) {
      $slug = $m.Groups[1].Value
      foreach ($name in @('pack.json','towers.webp','towers-glow.webp')) { $catalog.Add("assets/cities/$slug/$name") }
    }
  }
  $materialsJs = $entries | Where-Object FullName -eq 'js/render3d/city/materials.js' | Select-Object -First 1
  if ($materialsJs) {
    $r = [IO.StreamReader]::new($materialsJs.Open()); try { $code = $r.ReadToEnd() } finally { $r.Dispose() }
    foreach ($m in [regex]::Matches($code, '\bload\("([^"]+)"')) { if ($m.Groups[1].Value -notmatch '[/\\.]') { $catalog.Add("assets/textures/$($m.Groups[1].Value).jpg") } }
    foreach ($m in [regex]::Matches($code, '"uWall[DN]"\s*,\s*"([^"]+)"')) { $catalog.Add("assets/textures/$($m.Groups[1].Value).webp") }
  }
  $worldJs = $entries | Where-Object FullName -eq 'js/render3d/world.js' | Select-Object -First 1
  if ($worldJs) {
    $r = [IO.StreamReader]::new($worldJs.Open()); try { $code = $r.ReadToEnd() } finally { $r.Dispose() }
    foreach ($m in [regex]::Matches($code, '\bpbr\("([^"]+)"')) { $catalog.Add("assets/textures/asphalt_$($m.Groups[1].Value).jpg") }
  }
  foreach ($p in $catalog) { $referenced["runtime catalog -> $p"] = $p }

  foreach ($item in $referenced.GetEnumerator()) {
    if (-not $paths.Contains($item.Value)) {
      if ($folded.ContainsKey($item.Value)) { $problems.Add("Wrong letter case: $($item.Key) resolves to '$($folded[$item.Value])', expected '$($item.Value)'.") }
      else { $problems.Add("Missing file: $($item.Key) expects '$($item.Value)'.") }
    }
  }
  foreach ($item in $badExternal) { $problems.Add("HTTP link found: $item") }
  foreach ($item in $absolute) { $problems.Add("Absolute path found: $item") }

  $fileCount = $entries.Count
  $unpacked = ($entries | Measure-Object Length -Sum).Sum
  $biggest = ($entries | Measure-Object Length -Maximum).Maximum
  $longest = ($entries | ForEach-Object FullName | ForEach-Object Length | Measure-Object -Maximum).Maximum
  $badPaths = @($entries | Where-Object { $_.FullName.Length -gt 240 })
  if ($fileCount -gt 1000) { $problems.Add("ZIP contains $fileCount files; limit is 1,000.") }
  if ($unpacked -gt 500MB) { $problems.Add("Unpacked ZIP is $([math]::Round($unpacked / 1MB, 1)) MB; limit is 500 MB.") }
  if ($biggest -gt 200MB) { $problems.Add("Largest file is $([math]::Round($biggest / 1MB, 1)) MB; limit is 200 MB.") }
  if ($badPaths.Count) { $problems.Add("$($badPaths.Count) ZIP path(s) exceed 240 characters.") }

  'Referenced local paths (source -> requested path):'
  foreach ($item in $referenced.GetEnumerator() | Sort-Object Key) { '{0} -> {1} [{2}]' -f $item.Key, $item.Value, $(if ($paths.Contains($item.Value)) { 'OK' } else { 'MISSING' }) }
  ''
  'ZIP checks:'
  '  index.html at root: {0}' -f $paths.Contains('index.html')
  '  files: {0} / 1,000' -f $fileCount
  '  unpacked: {0:N1} MB / 500 MB' -f ($unpacked / 1MB)
  '  largest file: {0:N1} MB / 200 MB' -f ($biggest / 1MB)
  '  longest path: {0} / 240 characters' -f $longest
  if ($problems.Count) { $problems | ForEach-Object { "FAIL: $_" }; exit 1 }
  'PASS: all listed paths match the ZIP with exact letter casing; limits pass.'
} finally { $archive.Dispose() }
