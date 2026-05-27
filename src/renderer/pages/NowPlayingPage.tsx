import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3, Mic2, Music2 } from 'lucide-react';
import type { AudioStatus } from '../../shared/types/audio';
import type { AppSettings } from '../../shared/types/appSettings';
import type { PlaybackStatus } from '../../shared/types/playback';
import { PlayerStatusChips } from '../components/player/PlayerStatusChips';
import { titleFromPath } from '../components/player/playerFormat';
import { useI18n } from '../i18n/I18nProvider';
import { usePlaybackQueue } from '../stores/PlaybackQueueProvider';

const idlePollingStates = new Set(['paused', 'stopped', 'idle', 'error']);
const nowPlayingMarqueeOverflowPx = 4;
const readLowLoadPlaybackModeEnabled = (settings: Partial<AppSettings> | null | undefined): boolean =>
  settings?.lowLoadPlaybackModeEnabled === true;

const NowPlayingMarqueeText = ({
  as,
  className,
  text,
}: {
  as: 'h2' | 'p';
  className?: string;
  text: string;
}): JSX.Element => {
  const textRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    const innerElement = innerRef.current;
    if (!element || !innerElement) {
      setIsOverflowing(false);
      return undefined;
    }

    let frameId: number | null = null;
    const updateOverflow = (): void => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const distance = Math.max(0, innerElement.scrollWidth - element.clientWidth);
        element.style.setProperty('--now-playing-marquee-distance', `${distance + 22}px`);
        element.style.setProperty('--now-playing-marquee-duration', `${Math.min(24, Math.max(9, distance / 18 + 7))}s`);
        setIsOverflowing(distance > nowPlayingMarqueeOverflowPx);
      });
    };

    updateOverflow();

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateOverflow) : null;
    resizeObserver?.observe(element);
    resizeObserver?.observe(innerElement);
    window.addEventListener('resize', updateOverflow);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [text]);

  const setTextRef = (node: HTMLHeadingElement | HTMLParagraphElement | null): void => {
    textRef.current = node;
  };
  const props = {
    className: `now-playing-marquee ${className ?? ''}`,
    'data-overflow': isOverflowing ? 'true' : undefined,
    title: text,
  };
  const content = <span ref={innerRef}>{text}</span>;

  return as === 'h2' ? (
    <h2 {...props} ref={setTextRef}>
      {content}
    </h2>
  ) : (
    <p {...props} ref={setTextRef}>
      {content}
    </p>
  );
};

export const NowPlayingPage = (): JSX.Element => {
  const { t } = useI18n();
  const queue = usePlaybackQueue();
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus | null>(null);
  const [lowLoadPlaybackModeEnabled, setLowLoadPlaybackModeEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = audioStatus?.state ?? playbackStatus?.state ?? 'idle';
  const pollIntervalMs = lowLoadPlaybackModeEnabled || idlePollingStates.has(state) ? 1800 : 500;
  const statusTrackId = playbackStatus?.currentTrackId ?? audioStatus?.currentTrackId ?? null;
  const currentTrack =
    queue.currentTrack ??
    (statusTrackId ? queue.tracks.find((track) => track.id === statusTrackId) ?? null : null) ??
    (queue.lastPlayedTrack?.id === statusTrackId ? queue.lastPlayedTrack : null);
  const filePath = currentTrack?.path ?? audioStatus?.currentFilePath ?? playbackStatus?.filePath ?? null;
  const title = currentTrack?.title ?? titleFromPath(filePath);
  const artist = currentTrack?.artist || currentTrack?.albumArtist || (filePath ? t('nowPlaying.localFile') : t('nowPlaying.ready'));
  const coverUrl = currentTrack?.coverThumb ?? null;

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
      const nextTrackId = nextPlaybackStatus.currentTrackId ?? nextAudioStatus.currentTrackId ?? null;
      if (nextTrackId) {
        queue.setCurrentTrackId(nextTrackId);
      }
      setError(nextAudioStatus.error);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : String(statusError));
    }
  }, [queue]);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [pollIntervalMs, refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    const applySettings = (settings: Partial<AppSettings> | null | undefined): void => {
      if (!cancelled) {
        setLowLoadPlaybackModeEnabled(readLowLoadPlaybackModeEnabled(settings));
      }
    };

    void window.echo?.app?.getSettings?.().then(applySettings).catch(() => undefined);

    const handleSettingsChanged = (event: Event): void => {
      const patch = (event as CustomEvent<Partial<AppSettings> | null | undefined>).detail;
      if (!patch || !Object.prototype.hasOwnProperty.call(patch, 'lowLoadPlaybackModeEnabled')) {
        return;
      }
      applySettings(patch);
    };

    window.addEventListener('settings:changed', handleSettingsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('settings:changed', handleSettingsChanged);
    };
  }, []);

  return (
    <div className="page-stack now-playing-page">
      <section className="page-header">
        <div>
          <p className="section-kicker">{t('nowPlaying.kicker')}</p>
          <h1>{t('nowPlaying.title')}</h1>
          <p>{t('nowPlaying.description')}</p>
        </div>
        <button className="primary-action" type="button" onClick={() => window.dispatchEvent(new Event('app:navigate:lyrics'))}>
          <Mic2 size={17} />
          {t('nowPlaying.action.openLyrics')}
        </button>
      </section>

      <section className="now-playing-card">
        <div className="now-playing-cover" data-empty={!coverUrl}>
          {coverUrl ? <img alt="" src={coverUrl} /> : <Disc3 size={34} />}
        </div>
        <div className="now-playing-copy">
          <span>{currentTrack || filePath ? t('nowPlaying.state.playing') : t('nowPlaying.state.idle')}</span>
          <NowPlayingMarqueeText as="h2" text={currentTrack || filePath ? title : t('nowPlaying.emptyTitle')} />
          <NowPlayingMarqueeText as="p" text={artist} />
          <PlayerStatusChips status={audioStatus} state={state} track={currentTrack} />
          {error ? <strong className="now-playing-error">{error}</strong> : null}
        </div>
      </section>

      {!currentTrack && !filePath ? (
        <section className="empty-inline">
          <Music2 size={28} />
          <span>{t('nowPlaying.emptyDescription')}</span>
        </section>
      ) : null}
    </div>
  );
};
