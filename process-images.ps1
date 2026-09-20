# 翻譯圖裁切工具：1920x1080 原圖 → 取右半 1120x1080 → 輸出 webp
#
# 用法範例：
#   .\process-images.ps1 -InputFolder "C:\Users\Johna\Downloads\hEB01\hEB01" -AutoRoute
#     ↑ 依檔名自動分流到對應的 <彈數>-trans 資料夾
#   .\process-images.ps1 -InputFolder "...\某資料夾" -OutputFolder "...\webpcards\hBP01-trans"
#     ↑ 全部輸出到指定資料夾
#
# AutoRoute 命名規則：
#   hEB01-hBP01-021.jpg → hEB01-trans\hBP01-021.webp   （復刻卡：前綴=所在彈數，其餘=卡號）
#   hEB01-001.jpg       → hEB01-trans\hEB01-001.webp   （自身卡）
#   hBP04-001.jpg       → hBP04-trans\hBP04-001.webp
param(
    [string]$InputFolder  = "C:\Users\Johna\Downloads\hBP01-051.jpg",
    [string]$OutputFolder = "C:\Users\Johna\Desktop\holotcg-online\client\public\webpcards\hBP01-trans",
    [string]$WebpRoot     = "C:\Users\Johna\Desktop\holotcg-online\client\public\webpcards",
    [switch]$AutoRoute,
    [string]$Prefix       = "hSD04",
    [int]$Width           = 1120,
    [int]$Height          = 1080,
    [switch]$UsePrefix,
    [switch]$DryRun
)

$magick = if ($env:MAGICK) { $env:MAGICK } else { "magick" }  # 預設用 PATH 上的 magick，路徑不同可用環境變數 MAGICK 指定

if (-not $AutoRoute -and -not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

$images = Get-ChildItem -Path $InputFolder -File |
    Where-Object { $_.Extension -match '(?i)\.jpe?g$|\.png$' } |
    Sort-Object Name

$count = 1
$routed = @{}
foreach ($img in $images) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($img.Name)

    if ($UsePrefix) {
        $outName = "{0}-{1:D3}" -f $Prefix, $count
        $outDir  = $OutputFolder
    }
    elseif ($AutoRoute) {
        # <所在彈數>-<完整卡號> → 資料夾取前綴、檔名取卡號
        if ($baseName -match '^(h[A-Za-z]+\d*)-(h[A-Za-z]+\d*-\d{3}.*)$') {
            $setCode = $Matches[1]
            $outName = $Matches[2]
        }
        # 自身卡：檔名本身就是卡號
        elseif ($baseName -match '^(h[A-Za-z]+\d*)-\d{3}') {
            $setCode = $Matches[1]
            $outName = $baseName
        }
        else {
            Write-Host "⚠️  略過（檔名無法判斷彈數）：$($img.Name)" -ForegroundColor Yellow
            continue
        }
        $outDir = Join-Path $WebpRoot "$setCode-trans"
        if (-not $DryRun -and -not (Test-Path $outDir)) {
            New-Item -ItemType Directory -Path $outDir | Out-Null
        }
    }
    else {
        $outName = $baseName
        $outDir  = $OutputFolder
    }

    $outputPath = Join-Path $outDir "$outName.webp"
    $shortDir = Split-Path $outDir -Leaf
    Write-Host ("[{0,3}] {1} ➜ {2}\{3}.webp" -f $count, $img.Name, $shortDir, $outName)

    if (-not $DryRun) {
        & $magick "$($img.FullName)" -gravity East -crop "${Width}x${Height}+0+0" +repage "$outputPath"
    }

    if (-not $routed.ContainsKey($shortDir)) { $routed[$shortDir] = 0 }
    $routed[$shortDir]++
    $count++
}

Write-Host ""
if ($DryRun) { Write-Host "🔍 DryRun（未實際輸出）" -ForegroundColor Cyan }
Write-Host "✅ 共處理 $($count - 1) 張：" -ForegroundColor Green
$routed.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host ("   {0}  {1} 張" -f $_.Key, $_.Value)
}
