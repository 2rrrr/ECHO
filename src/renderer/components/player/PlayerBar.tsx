import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronUp,
  Gauge,
  Heart,
  ListMusic,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import type { AudioStatus } from '../../../shared/types/audio';
import type { PlaybackStatus } from '../../../shared/types/playback';

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatRate = (value: number | null): string => (value ? `${Math.round(value)} Hz` : 'n/a');

const basename = (filePath: string | null): string => {
  if (!filePath) {
    return 'No local file';
  }

  return filePath.split(/[\\/]/).pop() || filePath;
};

export const PlayerBar = (): JSX.Element => {
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<void> => {
    const echo = window.echo;

    if (!echo) {
      setError('Desktop bridge unavailable');
      return;
    }

    try {
      const [nextPlaybackStatus, nextAudioStatus] = await Promise.all([
        echo.playback.getStatus(),
        echo.audio.getStatus(),
      ]);
      setPlaybackStatus(nextPlaybackStatus);
      setAudioStatus(nextAudioStatus);
      setError(nextAudioStatus.error);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    // TODO: replace polling with playback/audio status push IPC after Phase 1.1.
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const isPlaying = audioStatus?.state === 'playing' || playbackStatus?.state === 'playing';
  const filePath = audioStatus?.currentFilePath ?? playbackStatus?.filePath ?? null;
  const trackId = audioStatus?.currentTrackId ?? playbackStatus?.currentTrackId ?? null;
  const positionSeconds = audioStatus?.positionSeconds ?? (playbackStatus?.positionMs ?? 0) / 1000;
  const durationSeconds = audioStatus?.durationSeconds ?? (playbackStatus?.durationMs ?? 0) / 1000;
  const progressPercent = durationSeconds > 0 ? Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100)) : 0;
  const state = audioStatus?.state ?? playbackStatus?.state ?? 'idle';
  const outputRows = useMemo(
    () => [
      ['state', state],
      ['codec', audioStatus?.codec ?? 'n/a'],
      ['fileSampleRate', formatRate(audioStatus?.fileSampleRate ?? null)],
      ['actualDeviceSampleRate', formatRate(audioStatus?.actualDeviceSampleRate ?? null)],
      ['outputMode', audioStatus?.outputMode ?? 'shared'],
      ['sampleRateMismatch', audioStatus?.sampleRateMismatch ? 'warning' : 'ok'],
    ],
    [audioStatus, state],
  );

  const handlePlayPause = useCallback(async (): Promise<void> => {
    const playback = window.echo?.playback;

    if (!playback) {
      return;
    }

    try {
      if (isPlaying) {
        setPlaybackStatus(await playback.pause());
      } else {
        setPlaybackStatus(await playback.play());
      }

      await refreshStatus();
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : String(playError));
    }
  }, [isPlaying, refreshStatus]);

  return (
    <footer className="player-bar" aria-label="Playback controls">
      <div className="player-now">
        <div className="player-cover" aria-hidden="true">
          <div className="cover-sheen" />
        </div>
        <div className="player-track-copy">
          <strong>{basename(filePath)}</strong>
          <span>{trackId ? `track id: ${trackId}` : 'track id: n/a'}</span>
          <div className="tag-row player-tags" aria-label="Audio status">
            {outputRows.map(([label, value]) => (
              <span className={`hifi-tag ${label === 'sampleRateMismatch' && value === 'warning' ? 'tag-hires' : 'tag-depth'}`} key={label}>
                {label}: {value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="player-center">
        <div className="transport">
          <button className="icon-button" type="button" aria-label="Queue" title="Queue">
            <ListMusic size={17} />
          </button>
          <button className="icon-button" type="button" aria-label="Shuffle" title="Shuffle">
            <Shuffle size={17} />
          </button>
          <button className="icon-button" type="button" aria-label="Previous" title="Previous">
            <SkipBack size={18} />
          </button>
          <button className="play-button" type="button" aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} onClick={() => void handlePlayPause()}>
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button className="icon-button" type="button" aria-label="Next" title="Next">
            <SkipForward size={18} />
          </button>
          <button className="icon-button is-soft-active" type="button" aria-label="Repeat" title="Repeat">
            <Repeat2 size={17} />
          </button>
          <button className="icon-button" type="button" aria-label="Lyrics" title="Lyrics">
            <Mic2 size={17} />
          </button>
          <button className="icon-button" type="button" aria-label="Like" title="Like">
            <Heart size={17} />
          </button>
        </div>

        <div className="progress-row" aria-label="Playback position">
          <span>{formatTime(positionSeconds)}</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            <div className="progress-thumb" style={{ left: `${progressPercent}%` }} />
          </div>
          <span>{formatTime(durationSeconds)}</span>
        </div>
        {error ? <span className="player-error">{error}</span> : null}
      </div>

      <div className="output-status">
        <span className={audioStatus?.sampleRateMismatch ? 'output-warning' : undefined}>
          {audioStatus?.sampleRateMismatch ? 'sample-rate mismatch' : audioStatus?.outputMode ?? 'shared'}
        </span>
        <button className="icon-button" type="button" aria-label="Volume" title="Volume">
          <Volume2 size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Output device" title="Output device">
          <Gauge size={17} />
        </button>
        <button className="icon-button" type="button" aria-label="Audio controls" title="Audio controls">
          <SlidersHorizontal size={17} />
        </button>
        <button className="icon-button" type="button" aria-label="More" title="More">
          <MoreHorizontal size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Expand player" title="Expand player">
          <ChevronUp size={18} />
        </button>
      </div>
    </footer>
  );
};
