package com.downloader.service;

import com.downloader.model.DownloadTask;
import com.downloader.model.FormatOption;
import com.downloader.model.VideoInfo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class VideoDownloaderService {

    private final Map<String, DownloadTask> tasks = new ConcurrentHashMap<>();
    private final Map<String, Process> activeProcesses = new ConcurrentHashMap<>();
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Pattern PROGRESS_PATTERN = Pattern.compile(
            "\\[download\\]\\s+(\\d+(\\.\\d+)?)%\\s+of\\s+~?(\\d+(\\.\\d+)?\\w+)\\s+at\\s+(\\d+(\\.\\d+)?\\w+/s)\\s+ETA\\s+(\\d+:\\d+|\\d+:\\d+:\\d+)"
    );
    private static final Pattern PERCENT_ONLY_PATTERN = Pattern.compile("\\[download\\]\\s+(\\d+(\\.\\d+)?)%");

    // Find the yt-dlp and ffmpeg executables relative to workspace
    private String getBinaryPath(String binaryName) {
        String os = System.getProperty("os.name").toLowerCase();
        String ext = os.contains("win") ? ".exe" : "";
        String userDir = System.getProperty("user.dir");
        
        // Check standard paths
        // 1. In bin/ directory of current working directory
        File binFolder = new File(userDir, "bin");
        File binaryFile = new File(binFolder, binaryName + ext);
        if (binaryFile.exists()) {
            return binaryFile.getAbsolutePath();
        }

        // 2. In backend/bin/ relative to current working directory (e.g. if run from parent folder)
        File parentBinFolder = new File(userDir, "backend/bin");
        File parentBinaryFile = new File(parentBinFolder, binaryName + ext);
        if (parentBinaryFile.exists()) {
            return parentBinaryFile.getAbsolutePath();
        }

        // 3. Fallback to system path
        return binaryName;
    }

    private boolean isValidCookiesFile(File file) {
        if (file == null || !file.exists() || !file.isFile()) {
            return false;
        }
        try (BufferedReader reader = new BufferedReader(new java.io.FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) {
                    continue;
                }
                if (line.startsWith("# Netscape HTTP Cookie File") || line.startsWith("# HTTP Cookie File")) {
                    return true;
                }
                if (line.startsWith("#")) {
                    continue;
                }
                return false;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private void appendCookieArgs(List<String> command) {
        String userDir = System.getProperty("user.dir");
        File cookiesFileRoot = new File(userDir, "cookies.txt");
        File cookiesFileBackend = new File(userDir, "backend/cookies.txt");
        File cookiesFileParent = new File(userDir, "../cookies.txt");
        
        if (isValidCookiesFile(cookiesFileRoot)) {
            command.add("--cookies");
            command.add(cookiesFileRoot.getAbsolutePath());
        } else if (isValidCookiesFile(cookiesFileBackend)) {
            command.add("--cookies");
            command.add(cookiesFileBackend.getAbsolutePath());
        } else if (isValidCookiesFile(cookiesFileParent)) {
            command.add("--cookies");
            command.add(cookiesFileParent.getAbsolutePath());
        }
    }

    public VideoInfo getVideoInfo(String url) throws Exception {
        String ytDlpPath = getBinaryPath("yt-dlp");
        
        List<String> command = new ArrayList<>(Arrays.asList(
                ytDlpPath,
                "--dump-json",
                "--no-playlist",
                "--geo-bypass",
                "--no-check-certificates"
        ));
        appendCookieArgs(command);
        command.add(url);
        
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        String jsonLine = null;
        StringBuilder fullOutput = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                fullOutput.append(line).append("\n");
                if (line.trim().startsWith("{")) {
                    jsonLine = line;
                }
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("yt-dlp failed to fetch video info. Output: " + fullOutput.toString().substring(0, Math.min(fullOutput.length(), 500)));
        }

        if (jsonLine == null) {
            throw new RuntimeException("yt-dlp completed successfully but returned no JSON data. Output: " + fullOutput.toString().substring(0, Math.min(fullOutput.length(), 500)));
        }

        JsonNode root = objectMapper.readTree(jsonLine);
        String title = root.path("title").asText("YouTube Video");
        String thumbnail = root.path("thumbnail").asText("");
        long duration = root.path("duration").asLong(0);
        String uploader = root.path("uploader").asText("Unknown Channel");

        List<FormatOption> formats = new ArrayList<>();
        JsonNode formatsNode = root.path("formats");
        if (formatsNode.isArray()) {
            for (JsonNode f : formatsNode) {
                String formatId = f.path("format_id").asText();
                String ext = f.path("ext").asText();
                String vcodec = f.path("vcodec").asText("none");
                String acodec = f.path("acodec").asText("none");
                boolean hasVideo = !vcodec.equals("none");
                boolean hasAudio = !acodec.equals("none");

                // Skip non-audio and non-video formats (like dashboard manifests)
                if (!hasVideo && !hasAudio) {
                    continue;
                }

                String resolution = f.path("resolution").asText("");
                if (resolution.equals("multiple") || resolution.isEmpty()) {
                    resolution = hasVideo ? f.path("height").asInt(0) + "p" : "Audio Only";
                }

                long filesize = f.path("filesize").asLong(0);
                if (filesize == 0) {
                    filesize = f.path("filesize_approx").asLong(0);
                }

                int fps = f.path("fps").asInt(0);
                String formatNote = f.path("format_note").asText("");
                String codec = hasVideo ? vcodec : acodec;

                String displayFormatId = formatId;
                if (hasVideo && !hasAudio) {
                    // Combine high-quality video-only format with best audio automatically
                    displayFormatId = formatId + "+bestaudio";
                    formatNote = (formatNote.isEmpty() ? "" : formatNote + " ") + "(Requires Audio Merge)";
                }

                formats.add(new FormatOption(
                        displayFormatId,
                        ext,
                        resolution,
                        filesize > 0 ? filesize : null,
                        hasVideo,
                        hasAudio,
                        fps > 0 ? fps : null,
                        codec,
                        formatNote
                ));
            }
        }

        // Reverse formats list so high quality appears first
        Collections.reverse(formats);

        return new VideoInfo(url, title, thumbnail, duration, uploader, formats);
    }

    public DownloadTask startDownload(String url, String formatId, String title, String ext) {
        String taskId = UUID.randomUUID().toString();
        DownloadTask task = new DownloadTask(taskId, url, title, formatId, ext);
        tasks.put(taskId, task);

        executorService.submit(() -> runDownloadProcess(task));

        return task;
    }

    private void runDownloadProcess(DownloadTask task) {
        String ytDlpPath = getBinaryPath("yt-dlp");
        String ffmpegPath = getBinaryPath("ffmpeg");
        
        // Determine temporary output folder
        String userDir = System.getProperty("user.dir");
        File tempDir = new File(userDir, "temp");
        if (!tempDir.exists()) {
            tempDir.mkdirs();
        }

        // Output template. Note that yt-dlp will substitute the extension dynamically
        String outputTemplate = new File(tempDir, task.getTaskId() + ".%(ext)s").getAbsolutePath();

        List<String> command = new ArrayList<>(Arrays.asList(
                ytDlpPath,
                "-f", task.getFormatId(),
                "-o", outputTemplate,
                "--ffmpeg-location", ffmpegPath,
                "--no-playlist",
                "--geo-bypass",
                "--no-check-certificates"
        ));
        appendCookieArgs(command);
        command.add(task.getUrl());

        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            activeProcesses.put(task.getTaskId(), process);

            task.setStatus("DOWNLOADING");
            notifyTaskUpdate(task);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    parseAndUpdateProgress(task, line);
                }
            }

            int exitCode = process.waitFor();
            activeProcesses.remove(task.getTaskId());

            if (exitCode == 0) {
                // Find the downloaded file. It will have the taskId as filename but dynamic extension
                File[] matchingFiles = tempDir.listFiles((dir, name) -> name.startsWith(task.getTaskId()));
                if (matchingFiles != null && matchingFiles.length > 0) {
                    File downloadedFile = matchingFiles[0];
                    task.setStatus("COMPLETED");
                    task.setProgress(100.0);
                    task.setSpeed("Done");
                    task.setEta("Completed");
                    task.setOutputFilePath(downloadedFile.getAbsolutePath());
                    // Update extension to actual
                    String actualExt = downloadedFile.getName().substring(downloadedFile.getName().lastIndexOf('.') + 1);
                    task.setExt(actualExt);
                    
                    notifyTaskUpdate(task);
                } else {
                    throw new IOException("Downloaded file not found in temp directory.");
                }
            } else {
                if ("CANCELED".equals(task.getStatus())) {
                    cleanTempFiles(task.getTaskId());
                } else {
                    task.setStatus("FAILED");
                    task.setError("yt-dlp exited with non-zero code: " + exitCode);
                    notifyTaskUpdate(task);
                }
            }

        } catch (Exception e) {
            activeProcesses.remove(task.getTaskId());
            if (!"CANCELED".equals(task.getStatus())) {
                task.setStatus("FAILED");
                task.setError("Exception: " + e.getMessage());
                notifyTaskUpdate(task);
            }
        }
    }

    private void parseAndUpdateProgress(DownloadTask task, String line) {
        if (line == null) return;

        // Check for FFmpeg merging phase
        if (line.contains("[Merger]") || line.contains("Merging formats") || line.contains("[ffmpeg]")) {
            task.setStatus("MERGING");
            task.setProgress(99.0);
            task.setSpeed("Merging streams...");
            task.setEta("A few seconds");
            notifyTaskUpdate(task);
            return;
        }

        Matcher m = PROGRESS_PATTERN.matcher(line);
        if (m.find()) {
            double progress = Double.parseDouble(m.group(1));
            task.setStatus("DOWNLOADING");
            task.setProgress(progress);
            task.setSpeed(m.group(5));
            task.setEta(m.group(7));
            notifyTaskUpdate(task);
        } else {
            Matcher m2 = PERCENT_ONLY_PATTERN.matcher(line);
            if (m2.find()) {
                double progress = Double.parseDouble(m2.group(1));
                task.setStatus("DOWNLOADING");
                task.setProgress(progress);
                notifyTaskUpdate(task);
            }
        }
    }

    public boolean cancelDownload(String taskId) {
        DownloadTask task = tasks.get(taskId);
        if (task == null) return false;

        Process process = activeProcesses.remove(taskId);
        if (process != null) {
            task.setStatus("CANCELED");
            process.destroyForcibly();
            
            // Allow process time to die and release file locks, then delete files in background
            executorService.submit(() -> {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignored) {}
                cleanTempFiles(taskId);
            });
            
            notifyTaskUpdate(task);
            return true;
        }
        return false;
    }

    public DownloadTask getTask(String taskId) {
        return tasks.get(taskId);
    }

    public void removeTask(String taskId) {
        tasks.remove(taskId);
    }

    public SseEmitter registerEmitter(String taskId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L); // 30 minutes timeout
        
        List<SseEmitter> taskEmitters = emitters.computeIfAbsent(taskId, k -> new CopyOnWriteArrayList<>());
        taskEmitters.add(emitter);

        emitter.onCompletion(() -> taskEmitters.remove(emitter));
        emitter.onTimeout(() -> taskEmitters.remove(emitter));
        emitter.onError((e) -> taskEmitters.remove(emitter));

        // Send current status immediately
        DownloadTask task = tasks.get(taskId);
        if (task != null) {
            try {
                emitter.send(SseEmitter.event().name("progress").data(task));
            } catch (IOException ignored) {}
        }

        return emitter;
    }

    private void notifyTaskUpdate(DownloadTask task) {
        List<SseEmitter> taskEmitters = emitters.get(task.getTaskId());
        if (taskEmitters == null || taskEmitters.isEmpty()) return;

        List<SseEmitter> deadEmitters = new ArrayList<>();
        for (SseEmitter emitter : taskEmitters) {
            try {
                emitter.send(SseEmitter.event().name("progress").data(task));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }
        taskEmitters.removeAll(deadEmitters);
    }

    private void cleanTempFiles(String taskId) {
        String userDir = System.getProperty("user.dir");
        File tempDir = new File(userDir, "temp");
        if (tempDir.exists() && tempDir.isDirectory()) {
            File[] files = tempDir.listFiles((dir, name) -> name.startsWith(taskId));
            if (files != null) {
                for (File file : files) {
                    file.delete();
                }
            }
        }
    }
}
