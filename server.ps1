# 책톡네컷 (Chaektok 4-Cuts) Local Backend Server
param(
    [int]$Port = 8890
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = $PSScriptRoot
$photosDir = Join-Path $rootDir "photos"
if (!(Test-Path $photosDir)) {
    New-Item -ItemType Directory -Path $photosDir -Force | Out-Null
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "=================================================" -ForegroundColor Cyan
    Write-Host "   책톡네컷 (Chaektok 4-Cuts) 서버가 시작되었습니다!   " -ForegroundColor Green
    Write-Host "   주소: $prefix" -ForegroundColor Yellow
    Write-Host "=================================================" -ForegroundColor Cyan
} catch {
    Write-Error "포트 $Port 를 시작할 수 없습니다: $_"
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".wav"  = "audio/wav"
    ".mp3"  = "audio/mpeg"
}

function Send-Response {
    param(
        $Response,
        [int]$StatusCode,
        [string]$ContentType,
        [byte[]]$ContentBytes
    )
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.AddHeader("Access-Control-Allow-Origin", "*")
    $Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $Response.AddHeader("Access-Control-Allow-Headers", "Content-Type")
    $Response.ContentLength64 = $ContentBytes.Length
    $Response.OutputStream.Write($ContentBytes, 0, $ContentBytes.Length)
    $Response.OutputStream.Close()
}

function Send-JsonResponse {
    param(
        $Response,
        [int]$StatusCode,
        $Data
    )
    $json = $Data | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-Response -Response $Response -StatusCode $StatusCode -ContentType "application/json; charset=utf-8" -ContentBytes $bytes
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.HttpMethod -eq "OPTIONS") {
            Send-Response -Response $response -StatusCode 200 -ContentType "text/plain" -ContentBytes @()
            continue
        }

        $rawUrl = $request.Url.LocalPath
        $urlDecoded = [System.Uri]::UnescapeDataString($rawUrl)
        if ([string]::IsNullOrWhiteSpace($urlDecoded) -or $urlDecoded -eq "/") {
            $urlDecoded = "/index.html"
        }

        # API Handlers
        if ($urlDecoded -eq "/api/printers") {
            $printers = Get-Printer | Select-Object Name, Type, DriverName, PrinterStatus, Shared
            Send-JsonResponse -Response $response -StatusCode 200 -Data @{
                success = $true
                printers = $printers
            }
            continue
        }

        if ($urlDecoded -eq "/api/save" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json

            $ts = Get-Date -Format "yyyyMMdd_HHmmss"
            $sessionDir = Join-Path $photosDir $ts
            New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null

            $mainFilePath = Join-Path $sessionDir "chaektok4cut_$ts.png"
            $a4FilePath = Join-Path $sessionDir "chaektok4cut_A4_$ts.png"

            if ($payload.mainImage) {
                $b64 = $payload.mainImage -replace '^data:image/[^;]+;base64,', ''
                [IO.File]::WriteAllBytes($mainFilePath, [Convert]::FromBase64String($b64))
            }

            if ($payload.a4Image) {
                $b64A4 = $payload.a4Image -replace '^data:image/[^;]+;base64,', ''
                [IO.File]::WriteAllBytes($a4FilePath, [Convert]::FromBase64String($b64A4))
            }

            if ($payload.cuts) {
                for ($i = 0; $i -lt $payload.cuts.Count; $i++) {
                    $cutPath = Join-Path $sessionDir "cut_$($i + 1).png"
                    $b64Cut = $payload.cuts[$i] -replace '^data:image/[^;]+;base64,', ''
                    [IO.File]::WriteAllBytes($cutPath, [Convert]::FromBase64String($b64Cut))
                }
            }

            Send-JsonResponse -Response $response -StatusCode 200 -Data @{
                success = $true
                timestamp = $ts
                files = @{
                    main = $mainFilePath
                    a4 = $a4FilePath
                }
            }
            continue
        }

        if ($urlDecoded -eq "/api/print" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json

            $imagePath = $payload.imagePath
            $printerName = $payload.printerName

            if ($imagePath -and (Test-Path $imagePath)) {
                $fullImgPath = (Resolve-Path $imagePath).Path
                Start-Process -FilePath "mspaint.exe" -ArgumentList "/pt `"$fullImgPath`" `"$printerName`"" -WindowStyle Hidden
                Send-JsonResponse -Response $response -StatusCode 200 -Data @{ success = $true; message = "인쇄 명령 전송 완료" }
            } else {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{ success = $false; message = "이미지 파일을 찾을 수 없습니다." }
            }
            continue
        }

        # Static File Serving
        $relativeFilePath = $urlDecoded.TrimStart("/").Replace("/", "\")
        $localFilePath = Join-Path $rootDir $relativeFilePath

        if (Test-Path $localFilePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($localFilePath)
            Send-Response -Response $response -StatusCode 200 -ContentType $contentType -ContentBytes $bytes
        } else {
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            Send-Response -Response $response -StatusCode 404 -ContentType "text/plain; charset=utf-8" -ContentBytes $notFound
        }
    } catch {
        Write-Host "요청 처리 중 오류 발생: $_" -ForegroundColor Red
    }
}
