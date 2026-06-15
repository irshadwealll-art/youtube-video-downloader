package com.downloader.controller;

import com.downloader.model.DownloadTask;
import com.downloader.model.VideoInfo;
import com.downloader.service.VideoDownloaderService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/video")
public class VideoController {

    private final VideoDownloaderService downloaderService;

    @Autowired
    public VideoController(VideoDownloaderService downloaderService) {
        this.downloaderService = downloaderService;
    }

    @GetMapping("/info")
    public ResponseEntity<?> getVideoInfo(@RequestParam String url) {
        if (url == null || url.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "URL parameter is required"));
        }
        try {
            VideoInfo videoInfo = downloaderService.getVideoInfo(url);
            return ResponseEntity.ok(videoInfo);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve video details: " + e.getMessage()));
        }
    }

    @PostMapping("/download")
    public ResponseEntity<?> startDownload(@RequestBody Map<String, String> request) {
        String url = request.get("url");
        String formatId = request.get("formatId");
        String title = request.get("title");
        String ext = request.get("ext");

        if (url == null || formatId == null || title == null || ext == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Required fields: url, formatId, title, ext"));
        }

        try {
            DownloadTask task = downloaderService.startDownload(url, formatId, title, ext);
            return ResponseEntity.ok(Map.of("taskId", task.getTaskId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to start download: " + e.getMessage()));
        }
    }

    @GetMapping("/tasks/{taskId}/progress")
    public SseEmitter streamProgress(@PathVariable String taskId) {
        return downloaderService.registerEmitter(taskId);
    }

    @PostMapping("/tasks/{taskId}/cancel")
    public ResponseEntity<?> cancelDownload(@PathVariable String taskId) {
        boolean cancelled = downloaderService.cancelDownload(taskId);
        if (cancelled) {
            return ResponseEntity.ok(Map.of("message", "Download cancelled successfully."));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Task not found or not currently running."));
        }
    }

    @GetMapping("/tasks/{taskId}/file")
    public void downloadFile(@PathVariable String taskId, HttpServletResponse response) throws IOException {
        DownloadTask task = downloaderService.getTask(taskId);
        if (task == null) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "Download task not found.");
            return;
        }

        if (!"COMPLETED".equals(task.getStatus())) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "File is not ready yet. Current status: " + task.getStatus());
            return;
        }

        String path = task.getOutputFilePath();
        if (path == null) {
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Output path is missing.");
            return;
        }

        File file = new File(path);
        if (!file.exists()) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "Downloaded file does not exist on disk.");
            return;
        }

        // Sanitize title for filename
        String safeTitle = task.getTitle().replaceAll("[\\\\/:*?\"<>|]", "_");
        String filename = safeTitle + "." + task.getExt();

        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.setContentLengthLong(file.length());

        try (FileInputStream in = new FileInputStream(file);
             OutputStream out = response.getOutputStream()) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            out.flush();
        } finally {
            // Delete the file and cleanup task from list
            file.delete();
            downloaderService.removeTask(taskId);
        }
    }
}
