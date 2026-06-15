# setup.ps1
# This script sets up a portable, local development environment for the YouTube Video Downloader.
# It downloads and configures JDK 17, Apache Maven, yt-dlp.exe, and ffmpeg.exe locally.

$Workspace = $PSScriptRoot
$BackendBin = Join-Path $Workspace "backend\bin"

# Create backend binary folder
if (-not (Test-Path $BackendBin)) {
    Write-Host "Creating directory: $BackendBin"
    New-Item -ItemType Directory -Force -Path $BackendBin | Out-Null
}

Write-Host "=== Setting up Youtube Video Downloader environment ==="

# 1. Download yt-dlp.exe
$YtdlpPath = Join-Path $BackendBin "yt-dlp.exe"
if (-not (Test-Path $YtdlpPath)) {
    Write-Host "Downloading yt-dlp.exe from GitHub..."
    curl.exe -L -o $YtdlpPath "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if (Test-Path $YtdlpPath) {
        Write-Host "[SUCCESS] yt-dlp.exe downloaded."
    } else {
        Write-Error "Failed to download yt-dlp.exe."
        exit 1
    }
} else {
    Write-Host "[OK] yt-dlp.exe already exists."
}

# 2. Download FFmpeg essentials
$FfmpegExe = Join-Path $BackendBin "ffmpeg.exe"
$FfprobeExe = Join-Path $BackendBin "ffprobe.exe"
if (-not (Test-Path $FfmpegExe) -or -not (Test-Path $FfprobeExe)) {
    Write-Host "Downloading FFmpeg essentials zip..."
    $FfmpegZip = Join-Path $Workspace "ffmpeg.zip"
    # Download from Gyan.dev release builds
    curl.exe -L -o $FfmpegZip "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    if (Test-Path $FfmpegZip) {
        Write-Host "Extracting FFmpeg binaries..."
        $ExtractPath = Join-Path $Workspace "ffmpeg_temp"
        Expand-Archive -Path $FfmpegZip -DestinationPath $ExtractPath -Force
        
        # Locate ffmpeg.exe and ffprobe.exe in the extracted contents and move to bin
        $FoundFfmpeg = Get-ChildItem -Path $ExtractPath -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
        $FoundFfprobe = Get-ChildItem -Path $ExtractPath -Filter "ffprobe.exe" -Recurse | Select-Object -First 1

        if ($FoundFfmpeg) {
            Move-Item -Path $FoundFfmpeg.FullName -Destination $FfmpegExe -Force
        }
        if ($FoundFfprobe) {
            Move-Item -Path $FoundFfprobe.FullName -Destination $FfprobeExe -Force
        }

        # Clean up temp files and download zip
        Remove-Item -Path $ExtractPath -Recurse -Force
        Remove-Item -Path $FfmpegZip -Force
        Write-Host "[SUCCESS] FFmpeg binaries set up."
    } else {
        Write-Error "Failed to download FFmpeg zip."
        exit 1
    }
} else {
    Write-Host "[OK] FFmpeg binaries already exist."
}

# 3. Download portable JDK 17
$JdkFolder = Join-Path $Workspace "jdk"
if (-not (Test-Path $JdkFolder)) {
    Write-Host "Downloading portable Eclipse Temurin JDK 17..."
    $JdkZip = Join-Path $Workspace "jdk.zip"
    curl.exe -L -o $JdkZip "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/adoptium"
    if (Test-Path $JdkZip) {
        Write-Host "Extracting JDK..."
        $ExtractPath = Join-Path $Workspace "jdk_temp"
        Expand-Archive -Path $JdkZip -DestinationPath $ExtractPath -Force

        # The zip contains a root folder named like jdk-17.x.x+x
        $Subdir = Get-ChildItem -Path $ExtractPath -Directory | Select-Object -First 1
        if ($Subdir) {
            Move-Item -Path $Subdir.FullName -Destination $JdkFolder -Force
        }
        
        Remove-Item -Path $ExtractPath -Recurse -Force
        Remove-Item -Path $JdkZip -Force
        Write-Host "[SUCCESS] Local JDK 17 set up."
    } else {
        Write-Error "Failed to download JDK zip."
        exit 1
    }
} else {
    Write-Host "[OK] Local JDK 17 already exists."
}

# 4. Download portable Apache Maven 3.9.6
$MavenFolder = Join-Path $Workspace "maven"
if (-not (Test-Path $MavenFolder)) {
    Write-Host "Downloading portable Apache Maven 3.9.6..."
    $MavenZip = Join-Path $Workspace "maven.zip"
    curl.exe -L -o $MavenZip "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.6/apache-maven-3.9.6-bin.zip"
    if (Test-Path $MavenZip) {
        Write-Host "Extracting Maven..."
        $ExtractPath = Join-Path $Workspace "maven_temp"
        Expand-Archive -Path $MavenZip -DestinationPath $ExtractPath -Force

        $Subdir = Get-ChildItem -Path $ExtractPath -Directory | Select-Object -First 1
        if ($Subdir) {
            Move-Item -Path $Subdir.FullName -Destination $MavenFolder -Force
        }
        
        Remove-Item -Path $ExtractPath -Recurse -Force
        Remove-Item -Path $MavenZip -Force
        Write-Host "[SUCCESS] Portable Maven set up."
    } else {
        Write-Error "Failed to download Maven zip."
        exit 1
    }
} else {
    Write-Host "[OK] Portable Maven already exists."
}

Write-Host "=== Setup completed successfully! ==="
Write-Host "Local Java binary: $(Join-Path $JdkFolder 'bin\java.exe')"
Write-Host "Local Maven binary: $(Join-Path $MavenFolder 'bin\mvn.cmd')"
Write-Host "Local yt-dlp binary: $YtdlpPath"
Write-Host "Local FFmpeg binary: $FfmpegExe"
