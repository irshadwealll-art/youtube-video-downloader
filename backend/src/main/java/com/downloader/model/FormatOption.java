package com.downloader.model;

public class FormatOption {
    private String formatId;
    private String ext;
    private String resolution;
    private Long filesize;
    private boolean hasVideo;
    private boolean hasAudio;
    private Integer fps;
    private String codec;
    private String formatNote;

    // Default constructor
    public FormatOption() {}

    // Constructor
    public FormatOption(String formatId, String ext, String resolution, Long filesize, 
                        boolean hasVideo, boolean hasAudio, Integer fps, String codec, String formatNote) {
        this.formatId = formatId;
        this.ext = ext;
        this.resolution = resolution;
        this.filesize = filesize;
        this.hasVideo = hasVideo;
        this.hasAudio = hasAudio;
        this.fps = fps;
        this.codec = codec;
        this.formatNote = formatNote;
    }

    // Getters and Setters
    public String getFormatId() {
        return formatId;
    }

    public void setFormatId(String formatId) {
        this.formatId = formatId;
    }

    public String getExt() {
        return ext;
    }

    public void setExt(String ext) {
        this.ext = ext;
    }

    public String getResolution() {
        return resolution;
    }

    public void setResolution(String resolution) {
        this.resolution = resolution;
    }

    public Long getFilesize() {
        return filesize;
    }

    public void setFilesize(Long filesize) {
        this.filesize = filesize;
    }

    public boolean isHasVideo() {
        return hasVideo;
    }

    public void setHasVideo(boolean hasVideo) {
        this.hasVideo = hasVideo;
    }

    public boolean isHasAudio() {
        return hasAudio;
    }

    public void setHasAudio(boolean hasAudio) {
        this.hasAudio = hasAudio;
    }

    public Integer getFps() {
        return fps;
    }

    public void setFps(Integer fps) {
        this.fps = fps;
    }

    public String getCodec() {
        return codec;
    }

    public void setCodec(String codec) {
        this.codec = codec;
    }

    public String getFormatNote() {
        return formatNote;
    }

    public void setFormatNote(String formatNote) {
        this.formatNote = formatNote;
    }
}
