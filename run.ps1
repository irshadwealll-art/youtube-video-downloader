# run.ps1
# This script starts the YouTube Video Downloader application.
# It launches the Java backend and React frontend in separate windows.

$Workspace = $PSScriptRoot

# 1. Run setup if any binary is missing
$JdkJava = Join-Path $Workspace "jdk\bin\java.exe"
$MvnCmd = Join-Path $Workspace "maven\bin\mvn.cmd"
$Ytdlp = Join-Path $Workspace "backend\bin\yt-dlp.exe"
$Ffmpeg = Join-Path $Workspace "backend\bin\ffmpeg.exe"

if (-not (Test-Path $JdkJava) -or -not (Test-Path $MvnCmd) -or -not (Test-Path $Ytdlp) -or -not (Test-Path $Ffmpeg)) {
    Write-Host "Local portable binaries are missing. Running setup.ps1 first..."
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $Workspace "setup.ps1")
}

Write-Host "=== Starting YouTube Video Downloader ==="

# Set JAVA_HOME for maven process
$env:JAVA_HOME = Join-Path $Workspace "jdk"

# 2. Start Backend in a new cmd window
Write-Host "Launching Spring Boot backend..."
Start-Process cmd.exe -ArgumentList "/k title YTube-Backend & `"$MvnCmd`" spring-boot:run" -WorkingDirectory (Join-Path $Workspace "backend")

# 3. Start Frontend in a new cmd window
Write-Host "Launching React frontend..."
Start-Process cmd.exe -ArgumentList "/k title YTube-Frontend & npm run dev" -WorkingDirectory (Join-Path $Workspace "frontend")

# 4. Wait for initialization
Write-Host "Waiting 6 seconds for servers to boot up..."
Start-Sleep -Seconds 6

# 5. Open browser
Write-Host "Opening web dashboard..."
Start-Process "http://localhost:5173"

Write-Host "=== Started successfully! ==="
Write-Host "Note: To stop the servers, simply close the popped-up command prompt windows."
