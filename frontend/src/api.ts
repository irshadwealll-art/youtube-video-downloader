// api.ts
// API integration for YouTube Video Downloader

export interface FormatOption {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  fps: number | null;
  codec: string;
  formatNote: string;
}

export interface VideoInfo {
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: FormatOption[];
}

export interface DownloadTask {
  taskId: string;
  url: string;
  title: string;
  ext: string;
  formatId: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'STARTING' | 'DOWNLOADING' | 'MERGING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  error: string | null;
  outputFilePath: string | null;
}

const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // Fall back to the active page's host (e.g. localhost or local IP) on port 8080
  const hostname = window.location.hostname;
  return `http://${hostname}:8080/api/video`;
};
const API_BASE = getApiBase();

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch video details.');
  }
  return response.json();
}

export async function requestDownload(
  url: string,
  formatId: string,
  title: string,
  ext: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, formatId, title, ext }),
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to start download.');
  }
  
  const data = await response.json();
  return data.taskId;
}

export async function cancelDownload(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to cancel download.');
  }
}

export function getDownloadUrl(taskId: string): string {
  return `${API_BASE}/tasks/${taskId}/file`;
}

export function subscribeToProgress(
  taskId: string,
  onMessage: (task: DownloadTask) => void,
  onError: (error: any) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/tasks/${taskId}/progress`);

  eventSource.addEventListener('progress', (event: MessageEvent) => {
    try {
      const task: DownloadTask = JSON.parse(event.data);
      onMessage(task);
    } catch (e) {
      onError(e);
    }
  });

  eventSource.onerror = (err) => {
    onError(err);
    eventSource.close();
  };

  // Return unsubscribe cleanup function
  return () => {
    eventSource.close();
  };
}
