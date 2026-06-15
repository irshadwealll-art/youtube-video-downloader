package com.downloader.model;

public class DownloadTask {
    private String taskId;
    private String url;
    private String title;
    private String ext;
    private String formatId;
    private double progress; // percentage (0 to 100)
    private String speed;    // e.g. "4.5 MiB/s"
    private String eta;      // e.g. "00:15"
    private String status;   // "STARTING", "DOWNLOADING", "MERGING", "COMPLETED", "FAILED", "CANCELED"
    private String error;
    private String outputFilePath;

    public DownloadTask() {}

    public DownloadTask(String taskId, String url, String title, String formatId, String ext) {
        this.taskId = taskId;
        this.url = url;
        this.title = title;
        this.formatId = formatId;
        this.ext = ext;
        this.progress = 0.0;
        this.speed = "0 B/s";
        this.eta = "--:--";
        this.status = "STARTING";
    }

    // Getters and Setters
    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getExt() {
        return ext;
    }

    public void setExt(String ext) {
        this.ext = ext;
    }

    public String getFormatId() {
        return formatId;
    }

    public void setFormatId(String formatId) {
        this.formatId = formatId;
    }

    public double getProgress() {
        return progress;
    }

    public void setProgress(double progress) {
        this.progress = progress;
    }

    public String getSpeed() {
        return speed;
    }

    public void setSpeed(String speed) {
        this.speed = speed;
    }

    public String getEta() {
        return eta;
    }

    public void setEta(String eta) {
        this.eta = eta;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getOutputFilePath() {
        return outputFilePath;
    }

    public void setOutputFilePath(String outputFilePath) {
        this.outputFilePath = outputFilePath;
    }
}
