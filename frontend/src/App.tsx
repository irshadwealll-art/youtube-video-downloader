import React, { useState, useEffect, useRef } from 'react';
import {
  fetchVideoInfo,
  requestDownload,
  cancelDownload,
  subscribeToProgress,
  getDownloadUrl
} from './api';
import type { VideoInfo, DownloadTask, FormatOption } from './api';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'youtube' | 'instagram' | 'tiktok' | 'twitter'>('home');
  const [url, setUrl] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  
  // Download State
  const [activeTask, setActiveTask] = useState<DownloadTask | null>(null);
  const [downloading, setDownloading] = useState(false);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  // Clean up states when changing pages
  useEffect(() => {
    setUrl('');
    setError(null);
    setSuccess(null);
    setVideoInfo(null);
    setLoadingInfo(false);
  }, [currentPage]);

  // Clean up SSE subscription on unmount
  useEffect(() => {
    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
      }
    };
  }, []);

  // Format Helpers
  const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (hrs > 0) parts.push(hrs.toString().padStart(2, '0'));
    parts.push(mins.toString().padStart(2, '0'));
    parts.push(secs.toString().padStart(2, '0'));
    return parts.join(':');
  };

  const formatSize = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Event Handlers
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoadingInfo(true);
    setError(null);
    setSuccess(null);
    setVideoInfo(null);

    try {
      const info = await fetchVideoInfo(url);
      setVideoInfo(info);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching video details.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleStartDownload = async (format: FormatOption) => {
    if (!videoInfo) return;
    setError(null);
    setSuccess(null);
    setDownloading(true);

    try {
      const taskId = await requestDownload(
        videoInfo.url,
        format.formatId,
        videoInfo.title,
        format.ext
      );

      // Subscribe to real-time SSE progress updates
      const unsubscribe = subscribeToProgress(
        taskId,
        (task: DownloadTask) => {
          setActiveTask(task);
          
          if (task.status === 'COMPLETED') {
            setDownloading(false);
            setSuccess(`"${videoInfo.title}" downloaded successfully!`);
            
            // Trigger automatic browser download
            const fileUrl = getDownloadUrl(taskId);
            const link = document.createElement('a');
            link.href = fileUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setActiveTask(null);
            if (sseCleanupRef.current) {
              sseCleanupRef.current();
              sseCleanupRef.current = null;
            }
          } else if (task.status === 'FAILED') {
            setDownloading(false);
            setError(task.error || 'Download failed.');
            setActiveTask(null);
            if (sseCleanupRef.current) {
              sseCleanupRef.current();
              sseCleanupRef.current = null;
            }
          }
        },
        (err) => {
          console.error('SSE Error:', err);
          setError('Lost connection to download progress monitor.');
          setDownloading(false);
          setActiveTask(null);
        }
      );

      sseCleanupRef.current = unsubscribe;

    } catch (err: any) {
      setError(err.message || 'Failed to start download.');
      setDownloading(false);
    }
  };

  const handleCancelDownload = async () => {
    if (!activeTask) return;
    try {
      await cancelDownload(activeTask.taskId);
      setSuccess('Download was cancelled.');
    } catch (err: any) {
      setError('Failed to cancel download: ' + err.message);
    } finally {
      setDownloading(false);
      setActiveTask(null);
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
        sseCleanupRef.current = null;
      }
    }
  };

  // Filter video vs audio formats
  const filteredFormats = videoInfo
    ? videoInfo.formats.filter((f) => {
        if (activeTab === 'video') {
          return f.hasVideo;
        } else {
          return f.hasAudio && !f.hasVideo;
        }
      })
    : [];

  const getPageInfo = () => {
    switch (currentPage) {
      case 'youtube':
        return {
          title: 'YouTube Downloader',
          subtitle: 'Download YouTube Videos, Shorts, and Audio instantly',
          placeholder: 'Paste YouTube video or Shorts link here...',
          themeClass: 'yt-theme',
          icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '2rem', height: '2rem' }}>
              <path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )
        };
      case 'instagram':
        return {
          title: 'Instagram Downloader',
          subtitle: 'Download Instagram Reels, Videos, and IGTV posts',
          placeholder: 'Paste Instagram Reel or post link here...',
          themeClass: 'ig-theme',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.75rem', height: '1.75rem' }}>
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          )
        };
      case 'tiktok':
        return {
          title: 'TikTok Downloader',
          subtitle: 'Download TikTok Videos and Soundtracks in seconds',
          placeholder: 'Paste TikTok video link here...',
          themeClass: 'tt-theme',
          icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.75rem', height: '1.75rem' }}>
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .57.04.84.11V9.5a7.21 7.21 0 0 0-3.15-.31 7.24 7.24 0 0 0-5.32 6.77 7.23 7.23 0 0 0 11.63 6.1 7.18 7.18 0 0 0 3.16-5.88V8.77a10.17 10.17 0 0 0 6.64 2.14V7.5a6.07 6.07 0 0 1-3.74-1.81z"/>
            </svg>
          )
        };
      case 'twitter':
        return {
          title: 'Twitter / X Downloader',
          subtitle: 'Download videos and media posts from Twitter (X) status updates',
          placeholder: 'Paste Twitter/X status link here...',
          themeClass: 'tw-theme',
          icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          )
        };
      default:
        return {
          title: '',
          subtitle: '',
          placeholder: '',
          themeClass: '',
          icon: null
        };
    }
  };

  const renderHome = () => (
    <div className="home-container">
      <div className="hero-section">
        <h2 className="hero-title">FlowDownloader</h2>
        <p className="hero-subtitle">
          FlowDownloader is a premium all-in-one social media video and audio downloading tool. Copy and paste links from your favorite platform to save media content directly in high definition (up to 4K resolution) for free.
        </p>
      </div>

      <div className="services-grid">
        <div className="service-card yt" onClick={() => setCurrentPage('youtube')}>
          <div className="service-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
          <h3>YouTube Downloader</h3>
          <p>Extract videos, playlists, shorts, and audio streams in ultra high definitions. Fast merging via FFmpeg.</p>
          <span className="service-link">Open YouTube Downloader &rarr;</span>
        </div>

        <div className="service-card ig" onClick={() => setCurrentPage('instagram')}>
          <div className="service-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
          </div>
          <h3>Instagram Downloader</h3>
          <p>Download HD Instagram Reels, IGTV formats, and video posts securely and immediately.</p>
          <span className="service-link">Open Instagram Downloader &rarr;</span>
        </div>

        <div className="service-card tt" onClick={() => setCurrentPage('tiktok')}>
          <div className="service-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .57.04.84.11V9.5a7.21 7.21 0 0 0-3.15-.31 7.24 7.24 0 0 0-5.32 6.77 7.23 7.23 0 0 0 11.63 6.1 7.18 7.18 0 0 0 3.16-5.88V8.77a10.17 10.17 0 0 0 6.64 2.14V7.5a6.07 6.07 0 0 1-3.74-1.81z"/></svg>
          </div>
          <h3>TikTok Downloader</h3>
          <p>Save TikTok videos and original background audio tracks locally without any watermarks or restrictions.</p>
          <span className="service-link">Open TikTok Downloader &rarr;</span>
        </div>

        <div className="service-card tw" onClick={() => setCurrentPage('twitter')}>
          <div className="service-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <h3>Twitter / X Downloader</h3>
          <p>Extract high-quality MP4 video streams and GIF media directly from any Twitter or X post link.</p>
          <span className="service-link">Open Twitter Downloader &rarr;</span>
        </div>
      </div>

      <div className="about-section">
        <h3>Why Choose FlowDownloader?</h3>
        <div className="benefits-grid">
          <div className="benefit-item">
            <h4>🚀 Full Download Speed</h4>
            <p>Our server-side download engine processes links at lighting speed and streams them directly to your browser.</p>
          </div>
          <div className="benefit-item">
            <h4>🎨 Premium Design</h4>
            <p>A beautiful dark glassmorphic design that adapts to mobile, desktop, and tablets seamlessly.</p>
          </div>
          <div className="benefit-item">
            <h4>🔒 Safe & Secure</h4>
            <p>No account logins required, no cookies, no tracking. Safe downloads that respect your privacy.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const pageInfo = getPageInfo();

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => setCurrentPage('home')}>
          <div className="nav-logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <span>FlowDownloader</span>
        </div>
        <div className="nav-links">
          <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>Home</button>
          <button className={`nav-link ${currentPage === 'youtube' ? 'active' : ''}`} onClick={() => setCurrentPage('youtube')}>YouTube</button>
          <button className={`nav-link ${currentPage === 'instagram' ? 'active' : ''}`} onClick={() => setCurrentPage('instagram')}>Instagram</button>
          <button className={`nav-link ${currentPage === 'tiktok' ? 'active' : ''}`} onClick={() => setCurrentPage('tiktok')}>TikTok</button>
          <button className={`nav-link ${currentPage === 'twitter' ? 'active' : ''}`} onClick={() => setCurrentPage('twitter')}>Twitter/X</button>
        </div>
      </nav>

      {/* Render Home Page if selected */}
      {currentPage === 'home' ? (
        renderHome()
      ) : (
        /* Platform Downloader View */
        <>
          <header className="platform-header">
            <div className="logo-wrapper">
              <div className={`logo-icon ${pageInfo.themeClass}`}>
                {pageInfo.icon}
              </div>
              <h1 className="app-title">{pageInfo.title}</h1>
            </div>
            <p className="app-subtitle">{pageInfo.subtitle}</p>
          </header>

          {/* URL Input Card */}
          {!downloading && (
            <section className="card">
              <form onSubmit={handleSearch} className="search-form">
                <div className="input-group">
                  <input
                    type="text"
                    className="input-field"
                    placeholder={pageInfo.placeholder}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loadingInfo}
                    required
                  />
                  <span className="input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </span>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingInfo}>
                  {loadingInfo ? (
                    <>
                      <span className="spinner"></span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
                      </svg>
                      Analyze Link
                    </>
                  )}
                </button>
              </form>
            </section>
          )}

          {/* Notifications */}
          {error && (
            <div className="alert alert-danger">
              <span className="alert-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </span>
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <span className="alert-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <p>{success}</p>
            </div>
          )}

          {/* Video Details Card */}
          {videoInfo && !downloading && (
            <section className="card">
              <div className="video-preview">
                <div className="thumbnail-container">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="thumbnail-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640';
                    }}
                  />
                  <span className="duration-badge">{formatDuration(videoInfo.duration)}</span>
                </div>

                <div className="video-details">
                  <h2 className="video-title">{videoInfo.title}</h2>
                  <div className="uploader-name">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1rem', height: '1rem', color: 'var(--primary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {videoInfo.uploader}
                  </div>
                </div>
              </div>

              <div className="tabs-container">
                <div className="tab-headers">
                  <button
                    className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                    onClick={() => setActiveTab('video')}
                  >
                    Video + Audio
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audio')}
                  >
                    Audio Only
                  </button>
                </div>

                <div className="format-list">
                  {filteredFormats.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                      No available formats found.
                    </p>
                  ) : (
                    filteredFormats.map((format, idx) => (
                      <div key={idx} className="format-item">
                        <div className="format-info-left">
                          <div className="format-res">
                            {format.resolution}
                            {format.hasVideo && format.hasAudio ? (
                              <span className="badge badge-merged">Pre-Merged</span>
                            ) : format.hasVideo ? (
                              <span className="badge badge-video">Video Only</span>
                            ) : (
                              <span className="badge badge-audio">Audio Only</span>
                            )}
                            {format.fps ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{format.fps} fps</span> : null}
                          </div>
                          <div className="format-meta">
                            Codec: {format.codec} | .{format.ext} {format.formatNote ? `(${format.formatNote})` : ''}
                          </div>
                        </div>

                        <div className="format-action">
                          <span className="format-size">{formatSize(format.filesize)}</span>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => handleStartDownload(format)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Get
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Active Download Progress Card */}
          {downloading && (
            <section className="card progress-card">
              <div className="progress-header">
                <div className="progress-title-group">
                  <span className="progress-status-title">
                    {activeTask?.status === 'STARTING' && 'Starting download...'}
                    {activeTask?.status === 'DOWNLOADING' && 'Downloading Stream...'}
                    {activeTask?.status === 'MERGING' && 'Merging streams using FFmpeg...'}
                    {activeTask?.status === 'COMPLETED' && 'Preparing file...'}
                  </span>
                  <span className="progress-video-title" title={videoInfo?.title}>
                    {videoInfo?.title}
                  </span>
                </div>
                <span className="progress-percent">
                  {activeTask ? Math.round(activeTask.progress) : 0}%
                </span>
              </div>

              <div className="progress-bar-container">
                <div
                  className={`progress-bar-fill ${activeTask?.status === 'MERGING' ? 'pulse' : ''}`}
                  style={{ width: `${activeTask ? activeTask.progress : 0}%` }}
                ></div>
              </div>

              <div className="progress-stats">
                <div className="stat-box">
                  <div className="stat-label">Speed</div>
                  <div className="stat-val">{activeTask?.speed || '-- B/s'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Time Remaining</div>
                  <div className="stat-val">{activeTask?.eta || '--:--'}</div>
                </div>
              </div>

              <button
                className="btn btn-cancel"
                style={{ width: '100%', marginTop: '0.5rem' }}
                onClick={handleCancelDownload}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cancel Download
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
