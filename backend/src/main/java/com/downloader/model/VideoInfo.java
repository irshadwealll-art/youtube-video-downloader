package com.downloader.model;

import java.util.List;

public class VideoInfo {
    private String url;
    private String title;
    private String thumbnail;
    private long duration; // in seconds
    private String uploader;
    private List<FormatOption> formats;

    // Default constructor
    public VideoInfo() {}

    // Constructor
    public VideoInfo(String url, String title, String thumbnail, long duration, String uploader, List<FormatOption> formats) {
        this.url = url;
        this.title = title;
        this.thumbnail = thumbnail;
        this.duration = duration;
        this.uploader = uploader;
        this.formats = formats;
    }

    // Getters and Setters
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

    public String getThumbnail() {
        return thumbnail;
    }

    public void setThumbnail(String thumbnail) {
        this.thumbnail = thumbnail;
    }

    public long getDuration() {
        return duration;
    }

    public void setDuration(long duration) {
        this.duration = duration;
    }

    public String getUploader() {
        return uploader;
    }

    public void setUploader(String uploader) {
        this.uploader = uploader;
    }

    public List<FormatOption> getFormats() {
        return formats;
    }

    public void setFormats(List<FormatOption> formats) {
        this.formats = formats;
    }
}
