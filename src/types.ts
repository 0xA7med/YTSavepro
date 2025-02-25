export interface VideoFormat {
  itag: string;
  quality: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  contentLength: string;
  fps?: number;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  formats: VideoFormat[];
}

export interface ApiError {
  error: string;
}