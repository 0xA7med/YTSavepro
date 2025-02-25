export interface VideoFormat {
  itag: string | number;
  quality: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  fps?: number;
  filesize: number;
  audioQuality?: string | null;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  views: number;
  formats: VideoFormat[];
}

export interface ApiError {
  error: string;
  details?: string;
}