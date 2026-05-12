import type { AudioOutputSettings, AudioPlaybackState } from './audio';

export type PlaybackStatus = {
  state: AudioPlaybackState;
  currentTrackId: string | null;
  positionMs: number;
  durationMs: number;
  filePath: string | null;
};

export type PlaybackProbeHint = {
  durationSeconds?: number;
  fileSampleRate?: number | null;
  channels?: number;
  codec?: string | null;
  bitDepth?: number | null;
  bitrate?: number | null;
};

export type PlaybackStartRequest = {
  filePath: string;
  trackId?: string;
  startSeconds?: number;
  output?: AudioOutputSettings;
  probe?: PlaybackProbeHint;
};
