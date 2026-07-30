# diagnose-encoding.ps1 - 检查所有源文件的 UTF-8 编码与乱码字符
$ErrorActionPreference = 'Continue'
$OutputFile = "encoding_report.txt"
"" | Out-File -FilePath $OutputFile -Encoding utf8

Add-Content $OutputFile "===== 1. 关键源文件 UTF-8 签名检查 ====="
$criticalFiles = @(
  'src\components\common\Header.tsx',
  'src\components\common\Footer.tsx',
  'src\components\common\Logo.tsx',
  'src\components\SearchBar\SearchBar.tsx',
  'src\components\HerbCatalog\HerbCatalog.tsx',
  'src\components\RegionPanel\RegionPanel.tsx',
  'src\pages\Home.tsx',
  'src\App.tsx',
  'index.html',
  'src\index.css'
)
foreach ($rel in $criticalFiles) {
  $abs = Join-Path $PWD $rel
  if (-not (Test-Path $abs)) { Add-Content $OutputFile "MISSING: $rel" ; continue }
  $bytes = [System.IO.File]::ReadAllBytes($abs)
  $hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $size = $bytes.Length
  Add-Content $OutputFile ("{0,-55} | Size: {1,8} bytes | UTF-8 BOM: {2}" -f $rel, $size, $hasBOM)
}

Add-Content $OutputFile ""
Add-Content $OutputFile "===== 2. 替换字符 (U+FFFD / \uFFFD) 扫描 ====="
Add-Content $OutputFile "扫描所有 .tsx/.ts/.html/.css 文件中是否含有 \uFFFD（乱码标识符）"
$badFiles = @()
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.html,*.css -Path src,public,index.html -ErrorAction SilentlyContinue | ForEach-Object {
  $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
  $count = ([regex]::Matches($content, "\uFFFD")).Count
  if ($count -gt 0) {
    $badFiles += @{Path = $_.FullName; Count = $count}
    Add-Content $OutputFile ("BAD: {0} -> {1} 个 \uFFFD" -f $_.FullName.Replace($PWD.Path + '\', ''), $count)
  }
}
if ($badFiles.Count -eq 0) {
  Add-Content $OutputFile "GOOD: 所有扫描文件均无 \uFFFD 替换字符"
}

Add-Content $OutputFile ""
Add-Content $OutputFile "===== 3. 关键中文短语完整性验证 ====="
$phrases = @{
  '关于瑶医' = 'Header.tsx / Footer.tsx'
  '搜索草药、疗法' = 'SearchBar.tsx'
  '草药分类目录' = 'Home.tsx'
  '瑶医分布地图' = '多文件'
  '探索瑶族传统医学与草药资源' = 'index.html / Header'
  '关于本站' = 'Footer.tsx'
  '湖南省' = 'Home.tsx'
  '广西壮族自治区' = 'Home.tsx'
}
foreach ($phrase in $phrases.Keys) {
  $hits = Select-String -Path "src", "index.html" -Pattern ([regex]::Escape($phrase)) -SimpleMatch -ErrorAction SilentlyContinue | Select-Object -First 3
  if ($hits) {
    Add-Content $OutputFile ("OK: ""{0}"" 出现在 {1} 处" -f $phrase, $hits.Count)
  } else {
    Add-Content $OutputFile ("MISSING: ""{0}"" 未在源文件找到" -f $phrase)
  }
}

Add-Content $OutputFile ""
Add-Content $OutputFile "===== 4. 已部署 GitHub Pages Bundle 校验 ====="
try {
  $r = Invoke-WebRequest -Uri 'https://2645756121.github.io/yaoyi-map/' -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
  Add-Content $OutputFile ("Deployed index.html: HTTP $($r.StatusCode), $($r.RawContent.Length) bytes, Content-Type=$($r.Headers['Content-Type'])")
  # 查找 JS bundle 路径
  $jsMatch = Select-String -InputObject $r.RawContent -Pattern '/assets/[\w-]+\.js' -AllMatches
  if ($jsMatch.Matches.Count -gt 0) {
    $jsUrl = $jsMatch.Matches[0].Value
    Add-Content $OutputFile ("Main JS bundle: $jsUrl")
    $fullJs = "https://2645756121.github.io/yaoyi-map$jsUrl"
    $jr = Invoke-WebRequest -Uri $fullJs -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Add-Content $OutputFile ("  -> HTTP $($jr.StatusCode), $($jr.RawContent.Length) bytes")
    # 在 bundle 中搜索替换字符
    $badCount = ([regex]::Matches($jr.Content, "\uFFFD")).Count
    Add-Content $OutputFile ("  -> contains \uFFFD count: $badCount")
    # 搜索关键短语
    foreach ($p in @('关于瑶医','搜索草药','草药分类','瑶医分布地图')) {
      $ph = ([regex]::Matches($jr.Content, [regex]::Escape($p))).Count
      Add-Content $OutputFile ("  -> ""$p"" occurrences in bundle: $ph")
    }
  }
} catch {
  Add-Content $OutputFile ("ERROR fetching deployed site: $($_.Exception.Message)")
}

Add-Content $OutputFile ""
Add-Content $OutputFile "===== Done ====="
Write-Host "Report saved to $OutputFile"
Get-Content $OutputFile