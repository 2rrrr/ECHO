import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Activity,
  AudioLines,
  ChevronRight,
  Disc3,
  Film,
  ListMusic,
  Maximize2,
  Mic2,
  MonitorSpeaker,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Waves,
} from 'lucide-react';
import type { AudioOutputMode, AudioPlaybackState, AudioStatus } from '../../shared/types/audio';
import type { LibraryTrack } from '../../shared/types/library';
import type { PlaybackStatus } from '../../shared/types/playback';
import type { TrackLyrics } from '../../shared/types/lyrics';
import { streamingProviderNames, type StreamingProviderName } from '../../shared/types/streaming';
import { LyricsView, getActiveLyricIndex, getEstimatedPlainLyricIndex } from '../components/lyrics/LyricsView';
import { MvPanel, type MvAudioClock } from '../components/lyrics/MvPanel';
import type { LyricsState } from '../components/lyrics/lyricsTypes';
import { PlayerStatusChips } from '../components/player/PlayerStatusChips';
import { formatRate, formatTime, titleFromPath } from '../components/player/playerFormat';
import { useI18n } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/locales';
import { usePlaybackQueue } from '../stores/PlaybackQueueProvider';
import {
  getVisualPlaybackState,
  refreshPlaybackStatus,
  setPlaybackStatusSnapshot,
  useSharedPlaybackStatus,
} from '../stores/playbackStatusStore';

type ListeningRoomMode = 'lyrics' | 'mv';

type ListeningRoomCopy = {
  actionFullscreen: string;
  actionHideRail: string;
  actionNext: string;
  actionPause: string;
  actionPlay: string;
  actionPrevious: string;
  actionShowRail: string;
  bitPerfectNo: string;
  bitPerfectYes: string;
  chainClean: string;
  clockPending: string;
  dspActive: string;
  dspBypass: string;
  emptyArtist: string;
  emptyLyrics: string;
  emptyQueue: string;
  emptyTitle: string;
  headroom: string;
  kicker: string;
  localFile: string;
  modeAsio: string;
  modeExclusive: string;
  modeLyrics: string;
  modeMv: string;
  modeShared: string;
  modeSystem: string;
  modeUnknown: string;
  now: string;
  output: string;
  quality: string;
  queue: string;
  queueNext: string;
  signal: string;
  source: string;
  stateError: string;
  stateIdle: string;
  stateLoading: string;
  statePaused: string;
  statePlaying: string;
  stateReady: string;
  stateStopped: string;
  systemDefault: string;
  title: string;
  unknown: string;
  lyricsLoading: string;
  lyricsInstrumental: string;
  resampling: string;
};

const copyByLocale: Record<Locale, ListeningRoomCopy> = {
  'zh-CN': {
    actionFullscreen: '窗口全屏',
    actionHideRail: '收起链路侧栏',
    actionNext: '下一首',
    actionPause: '暂停',
    actionPlay: '播放',
    actionPrevious: '上一首',
    actionShowRail: '展开链路侧栏',
    bitPerfectNo: '非 1:1',
    bitPerfectYes: 'Bit-perfect 候选',
    chainClean: '链路干净',
    clockPending: '时钟待定',
    dspActive: 'DSP 已启用',
    dspBypass: 'DSP 旁路',
    emptyArtist: '从曲库开始后这里会接管舞台',
    emptyLyrics: '暂无歌词',
    emptyQueue: '队列里还没有下一首',
    emptyTitle: '等待播放',
    headroom: 'Headroom',
    kicker: 'LISTENING ROOM',
    localFile: '本地文件',
    modeAsio: 'ASIO',
    modeExclusive: 'Exclusive',
    modeLyrics: '歌词',
    modeMv: 'MV',
    modeShared: 'Shared',
    modeSystem: 'System',
    modeUnknown: '未知链路',
    now: 'NOW',
    output: '输出设备',
    quality: '音质状态',
    queue: '队列预览',
    queueNext: 'NEXT',
    signal: '当前链路',
    source: '来源',
    stateError: '异常',
    stateIdle: '空闲',
    stateLoading: '加载中',
    statePaused: '已暂停',
    statePlaying: '播放中',
    stateReady: '就绪',
    stateStopped: '已停止',
    systemDefault: '系统默认输出',
    title: '沉浸播放室',
    unknown: '未知',
    lyricsLoading: '正在读取歌词...',
    lyricsInstrumental: '纯音乐',
    resampling: '正在重采样',
  },
  'zh-TW': {
    actionFullscreen: '視窗全螢幕',
    actionHideRail: '收起鏈路側欄',
    actionNext: '下一首',
    actionPause: '暫停',
    actionPlay: '播放',
    actionPrevious: '上一首',
    actionShowRail: '展開鏈路側欄',
    bitPerfectNo: '非 1:1',
    bitPerfectYes: 'Bit-perfect 候選',
    chainClean: '鏈路乾淨',
    clockPending: '時鐘待定',
    dspActive: 'DSP 已啟用',
    dspBypass: 'DSP 旁路',
    emptyArtist: '從曲庫開始後這裡會接管舞台',
    emptyLyrics: '暫無歌詞',
    emptyQueue: '佇列裡還沒有下一首',
    emptyTitle: '等待播放',
    headroom: 'Headroom',
    kicker: 'LISTENING ROOM',
    localFile: '本機檔案',
    modeAsio: 'ASIO',
    modeExclusive: 'Exclusive',
    modeLyrics: '歌詞',
    modeMv: 'MV',
    modeShared: 'Shared',
    modeSystem: 'System',
    modeUnknown: '未知鏈路',
    now: 'NOW',
    output: '輸出裝置',
    quality: '音質狀態',
    queue: '佇列預覽',
    queueNext: 'NEXT',
    signal: '目前鏈路',
    source: '來源',
    stateError: '異常',
    stateIdle: '閒置',
    stateLoading: '載入中',
    statePaused: '已暫停',
    statePlaying: '播放中',
    stateReady: '就緒',
    stateStopped: '已停止',
    systemDefault: '系統預設輸出',
    title: '沉浸播放室',
    unknown: '未知',
    lyricsLoading: '正在讀取歌詞...',
    lyricsInstrumental: '純音樂',
    resampling: '正在重取樣',
  },
  'ja-JP': {
    actionFullscreen: 'ウィンドウを全画面',
    actionHideRail: 'チェーン欄を閉じる',
    actionNext: '次へ',
    actionPause: '一時停止',
    actionPlay: '再生',
    actionPrevious: '前へ',
    actionShowRail: 'チェーン欄を開く',
    bitPerfectNo: '1:1 ではない',
    bitPerfectYes: 'Bit-perfect 候補',
    chainClean: 'クリーンな経路',
    clockPending: 'クロック待機',
    dspActive: 'DSP 有効',
    dspBypass: 'DSP バイパス',
    emptyArtist: 'ライブラリから再生すると舞台に表示されます',
    emptyLyrics: '歌詞はありません',
    emptyQueue: '次の曲はまだありません',
    emptyTitle: '再生待機中',
    headroom: 'Headroom',
    kicker: 'LISTENING ROOM',
    localFile: 'ローカルファイル',
    modeAsio: 'ASIO',
    modeExclusive: 'Exclusive',
    modeLyrics: '歌詞',
    modeMv: 'MV',
    modeShared: 'Shared',
    modeSystem: 'System',
    modeUnknown: '不明な経路',
    now: 'NOW',
    output: '出力デバイス',
    quality: '音質ステータス',
    queue: 'キュー',
    queueNext: 'NEXT',
    signal: '現在の経路',
    source: 'ソース',
    stateError: 'エラー',
    stateIdle: '待機中',
    stateLoading: '読み込み中',
    statePaused: '一時停止',
    statePlaying: '再生中',
    stateReady: '準備完了',
    stateStopped: '停止',
    systemDefault: 'システム既定出力',
    title: 'リスニングルーム',
    unknown: '不明',
    lyricsLoading: '歌詞を読み込み中...',
    lyricsInstrumental: 'インストゥルメンタル',
    resampling: 'リサンプリング中',
  },
  'en-US': {
    actionFullscreen: 'Window fullscreen',
    actionHideRail: 'Collapse signal rail',
    actionNext: 'Next',
    actionPause: 'Pause',
    actionPlay: 'Play',
    actionPrevious: 'Previous',
    actionShowRail: 'Expand signal rail',
    bitPerfectNo: 'Not 1:1',
    bitPerfectYes: 'Bit-perfect candidate',
    chainClean: 'Clean chain',
    clockPending: 'Clock pending',
    dspActive: 'DSP enabled',
    dspBypass: 'DSP bypass',
    emptyArtist: 'Start playback from the library and this stage takes over',
    emptyLyrics: 'No lyrics yet',
    emptyQueue: 'No upcoming track in the queue',
    emptyTitle: 'Waiting for playback',
    headroom: 'Headroom',
    kicker: 'LISTENING ROOM',
    localFile: 'Local file',
    modeAsio: 'ASIO',
    modeExclusive: 'Exclusive',
    modeLyrics: 'Lyrics',
    modeMv: 'MV',
    modeShared: 'Shared',
    modeSystem: 'System',
    modeUnknown: 'Unknown route',
    now: 'NOW',
    output: 'Output Device',
    quality: 'Quality Status',
    queue: 'Queue Preview',
    queueNext: 'NEXT',
    signal: 'Signal Chain',
    source: 'Source',
    stateError: 'Error',
    stateIdle: 'Idle',
    stateLoading: 'Loading',
    statePaused: 'Paused',
    statePlaying: 'Playing',
    stateReady: 'Ready',
    stateStopped: 'Stopped',
    systemDefault: 'System default output',
    title: 'Listening Room',
    unknown: 'Unknown',
    lyricsLoading: 'Loading lyrics...',
    lyricsInstrumental: 'Instrumental',
    resampling: 'Resampling',
  },
};

const coverColorSampleSize = 32;
const maxCachedCoverPalettes = 64;
const coverPaletteCache = new Map<string, string | null>();

const activeStates = new Set<AudioPlaybackState>(['loading', 'playing']);
const receiverTrackIdPattern = /^(?:dlna|airplay)-receiver:/u;

const isStreamingProviderName = (value: string | null | undefined): value is StreamingProviderName =>
  streamingProviderNames.includes(value as StreamingProviderName);

const originalCoverUrlFromThumb = (coverUrl: string | null): string | null =>
  coverUrl?.startsWith('echo-cover://thumb/')
    ? coverUrl.replace('echo-cover://thumb/', 'echo-cover://original/')
    : coverUrl;

const artworkUrlForTrack = (track: Pick<LibraryTrack, 'coverId' | 'coverThumb'> | null): string | null =>
  track?.coverId ? `echo-cover://original/${encodeURIComponent(track.coverId)}` : originalCoverUrlFromThumb(track?.coverThumb ?? null);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeSpectrumValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0.08;
  }
  if (value < 0) {
    return Math.max(0.04, Math.min(1, (value + 80) / 80));
  }
  return Math.max(0.04, Math.min(1, value));
};

const stateLabel = (state: AudioPlaybackState | string, copy: ListeningRoomCopy): string => {
  switch (state) {
    case 'playing':
      return copy.statePlaying;
    case 'loading':
      return copy.stateLoading;
    case 'paused':
      return copy.statePaused;
    case 'stopped':
    case 'ended':
      return copy.stateStopped;
    case 'error':
      return copy.stateError;
    case 'idle':
      return copy.stateIdle;
    default:
      return copy.stateReady;
  }
};

const outputModeLabel = (mode: AudioOutputMode | null | undefined, copy: ListeningRoomCopy): string => {
  switch (mode) {
    case 'asio':
      return copy.modeAsio;
    case 'exclusive':
      return copy.modeExclusive;
    case 'shared':
      return copy.modeShared;
    case 'system':
      return copy.modeSystem;
    default:
      return copy.modeUnknown;
  }
};

const formatDb = (value: number | null | undefined, fallback: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return `${value.toFixed(1)} dB`;
};

const formatTrackSpec = (track: LibraryTrack | null, status: AudioStatus | null, copy: ListeningRoomCopy): string => {
  const codec = track?.codec ?? status?.codec ?? null;
  const bitDepth = track?.bitDepth ?? status?.bitDepth ?? null;
  const sampleRate = track?.sampleRate ?? status?.fileSampleRate ?? null;
  const parts = [
    codec?.toUpperCase() ?? null,
    bitDepth ? `${Math.round(bitDepth)}bit` : null,
    sampleRate ? formatRate(sampleRate) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' / ') : copy.unknown;
};

const readCoverPalette = (coverUrl: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (coverPaletteCache.has(coverUrl)) {
      resolve(coverPaletteCache.get(coverUrl) ?? null);
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = coverColorSampleSize;
        canvas.height = coverColorSampleSize;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          coverPaletteCache.set(coverUrl, null);
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, coverColorSampleSize, coverColorSampleSize);
        const data = context.getImageData(0, 0, coverColorSampleSize, coverColorSampleSize).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let weightTotal = 0;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3] / 255;
          if (alpha < 0.45) {
            continue;
          }

          const pixelRed = data[index];
          const pixelGreen = data[index + 1];
          const pixelBlue = data[index + 2];
          const max = Math.max(pixelRed, pixelGreen, pixelBlue);
          const min = Math.min(pixelRed, pixelGreen, pixelBlue);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const lightness = (max + min) / 510;
          const weight = alpha * (0.45 + saturation * 1.8) * (1 - Math.min(0.72, Math.abs(lightness - 0.52) * 1.3));
          red += pixelRed * weight;
          green += pixelGreen * weight;
          blue += pixelBlue * weight;
          weightTotal += weight;
        }

        const rgb = weightTotal > 0
          ? `${Math.round(red / weightTotal)} ${Math.round(green / weightTotal)} ${Math.round(blue / weightTotal)}`
          : null;
        if (coverPaletteCache.size >= maxCachedCoverPalettes) {
          const firstKey = coverPaletteCache.keys().next().value as string | undefined;
          if (firstKey) {
            coverPaletteCache.delete(firstKey);
          }
        }
        coverPaletteCache.set(coverUrl, rgb);
        resolve(rgb);
      } catch {
        coverPaletteCache.set(coverUrl, null);
        resolve(null);
      }
    };
    image.onerror = () => {
      coverPaletteCache.set(coverUrl, null);
      resolve(null);
    };
    image.src = coverUrl;
  });

const lyricsToState = (lyrics: TrackLyrics | null): LyricsState => ({
  kind: lyrics?.kind ?? 'empty',
  source: lyrics?.provider ?? 'none',
  lines: lyrics?.lines ?? [],
  offsetMs: lyrics?.offsetMs ?? 0,
});

const makeFallbackSpectrum = (seed: string, active: boolean): number[] => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }

  return Array.from({ length: 32 }, (_, index) => {
    const phase = (hash % 37) / 37 + index * 0.38;
    const wave = Math.sin(phase) * 0.5 + 0.5;
    return active ? 0.16 + wave * 0.72 : 0.08 + wave * 0.18;
  });
};

export const ListeningRoomPage = (): JSX.Element => {
  const { locale } = useI18n();
  const copy = copyByLocale[locale] ?? copyByLocale['zh-CN'];
  const queue = usePlaybackQueue();
  const sharedStatus = useSharedPlaybackStatus();
  const [statusUpdatedAtMs, setStatusUpdatedAtMs] = useState(() => performance.now());
  const [lyrics, setLyrics] = useState<TrackLyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ListeningRoomMode>('lyrics');
  const [isRailOpen, setIsRailOpen] = useState(() => window.innerWidth >= 1180);
  const [coverRgb, setCoverRgb] = useState<string | null>(null);

  const playbackStatus = sharedStatus.playbackStatus;
  const audioStatus = sharedStatus.audioStatus;
  const visualState = getVisualPlaybackState(sharedStatus);
  const statusTrackId = playbackStatus?.currentTrackId ?? audioStatus?.currentTrackId ?? null;
  const currentTrack =
    queue.currentTrack ??
    (statusTrackId ? queue.tracks.find((track) => track.id === statusTrackId) ?? null : null) ??
    (queue.lastPlayedTrack?.id === statusTrackId ? queue.lastPlayedTrack : null);
  const trackId = currentTrack?.id ?? statusTrackId ?? null;
  const filePath = currentTrack?.path ?? audioStatus?.currentFilePath ?? playbackStatus?.filePath ?? null;
  const title = currentTrack?.title ?? audioStatus?.currentTrackTitle ?? titleFromPath(filePath);
  const artist =
    currentTrack?.artist ||
    currentTrack?.albumArtist ||
    audioStatus?.currentTrackArtist ||
    audioStatus?.currentTrackAlbumArtist ||
    (filePath ? copy.localFile : copy.emptyArtist);
  const coverUrl = artworkUrlForTrack(currentTrack) ?? audioStatus?.currentTrackCoverUrl ?? null;
  const durationSeconds = audioStatus?.durationSeconds ?? (playbackStatus?.durationMs ?? Math.round((currentTrack?.duration ?? 0) * 1000)) / 1000;
  const positionSeconds = audioStatus?.positionSeconds ?? (playbackStatus?.positionMs ?? 0) / 1000;
  const playbackRate = audioStatus?.playbackRate ?? 1;
  const isPlaying = activeStates.has(visualState);
  const hasPlayableTarget = Boolean(filePath || currentTrack || queue.currentItem);
  const outputRate = audioStatus?.actualDeviceSampleRate ?? audioStatus?.requestedOutputSampleRate ?? audioStatus?.sharedDeviceSampleRate ?? null;
  const sourceRate = currentTrack?.sampleRate ?? audioStatus?.fileSampleRate ?? null;
  const routeLabel = outputModeLabel(audioStatus?.outputMode, copy);
  const stateText = currentTrack || filePath ? stateLabel(visualState, copy) : copy.stateReady;
  const progressPercent = durationSeconds > 0 ? clamp01(positionSeconds / durationSeconds) * 100 : 0;
  const energy = clamp01(audioStatus?.audioLevels?.visualEnergy ?? (isPlaying ? 0.42 : 0.08));
  const transient = clamp01(audioStatus?.audioLevels?.visualTransient ?? 0);
  const headroomDb = audioStatus?.audioLevels?.headroomDb ?? null;
  const headroomRisk = typeof headroomDb === 'number' && Number.isFinite(headroomDb) ? clamp01((3 - headroomDb) / 8) : 0;
  const trackSpec = formatTrackSpec(currentTrack, audioStatus, copy);
  const deviceName = audioStatus?.outputDeviceName ?? copy.systemDefault;
  const signalPath = `${sourceRate ? formatRate(sourceRate) : copy.clockPending} -> ${outputRate ? formatRate(outputRate) : copy.clockPending}`;
  const qualityLabel = audioStatus?.sampleRateMismatch
    ? copy.resampling
    : audioStatus?.bitPerfectCandidate
      ? copy.bitPerfectYes
      : copy.bitPerfectNo;
  const dspLabel = audioStatus?.dspActive ? copy.dspActive : copy.dspBypass;

  useEffect(() => {
    setStatusUpdatedAtMs(performance.now());
  }, [sharedStatus.version]);

  useEffect(() => {
    void refreshPlaybackStatus();
  }, []);

  useEffect(() => {
    let disposed = false;
    if (!coverUrl) {
      setCoverRgb(null);
      return undefined;
    }

    void readCoverPalette(coverUrl).then((rgb) => {
      if (!disposed) {
        setCoverRgb(rgb);
      }
    });

    return () => {
      disposed = true;
    };
  }, [coverUrl]);

  const lyricsSnapshotRequest = useMemo(() => {
    if (!currentTrack || !trackId) {
      return null;
    }
    if (!currentTrack.isTemporary && currentTrack.mediaType !== 'remote' && currentTrack.mediaType !== 'streaming' && !receiverTrackIdPattern.test(trackId)) {
      return null;
    }

    return {
      trackId,
      title,
      artist,
      album: currentTrack.album,
      albumArtist: currentTrack.albumArtist,
      durationSeconds: durationSeconds || currentTrack.duration || null,
      mediaType: currentTrack.mediaType,
      sourceId: currentTrack.sourceId,
      stableKey: currentTrack.stableKey,
      filePath,
    };
  }, [artist, currentTrack, durationSeconds, filePath, title, trackId]);

  const loadLyrics = useCallback(async (): Promise<void> => {
    const lyricsApi = window.echo?.lyrics;
    if (!lyricsApi || !trackId) {
      setLyrics(null);
      setLyricsLoading(false);
      return;
    }

    setLyricsLoading(true);
    try {
      const nextLyrics =
        lyricsSnapshotRequest && lyricsApi.getForSnapshot
          ? await lyricsApi.getForSnapshot(lyricsSnapshotRequest)
          : await lyricsApi.getForTrack(trackId);
      setLyrics(nextLyrics);
    } catch {
      setLyrics(null);
    } finally {
      setLyricsLoading(false);
    }
  }, [lyricsSnapshotRequest, trackId]);

  useEffect(() => {
    void loadLyrics();
    const unsubscribe = window.echo?.lyrics?.onChanged?.((changedTrackId) => {
      if (!trackId || changedTrackId === trackId) {
        void loadLyrics();
      }
    });
    return () => unsubscribe?.();
  }, [loadLyrics, trackId]);

  const lyricsState = useMemo(() => lyricsToState(lyrics), [lyrics]);
  const activeLyricIndex = useMemo(() => {
    if (lyricsState.lines.length === 0) {
      return -1;
    }
    const positionMs = positionSeconds * 1000;
    return lyricsState.kind === 'plain'
      ? getEstimatedPlainLyricIndex(lyricsState.lines, positionMs, durationSeconds * 1000)
      : getActiveLyricIndex(lyricsState.lines, positionMs, lyricsState.offsetMs);
  }, [durationSeconds, lyricsState, positionSeconds]);
  const activeLyricText = activeLyricIndex >= 0 ? lyricsState.lines[activeLyricIndex]?.text ?? null : null;

  const streamingTarget = useMemo(() => {
    if (
      currentTrack?.mediaType !== 'streaming' ||
      !isStreamingProviderName(currentTrack.provider) ||
      !currentTrack.providerTrackId
    ) {
      return null;
    }

    return {
      provider: currentTrack.provider,
      providerTrackId: currentTrack.providerTrackId,
    };
  }, [currentTrack]);

  const queuePreviewItems = useMemo(() => {
    const currentIndex = queue.items.findIndex((item) =>
      queue.currentQueueId ? item.queueId === queue.currentQueueId : item.track.id === queue.currentTrackId,
    );
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    return queue.items.slice(startIndex, startIndex + 5);
  }, [queue.currentQueueId, queue.currentTrackId, queue.items]);

  const spectrum = useMemo(() => {
    const telemetry = audioStatus?.audioLevels?.visualSpectrum;
    if (telemetry && telemetry.length > 0) {
      return telemetry.slice(0, 32).map(normalizeSpectrumValue);
    }
    return makeFallbackSpectrum(trackId ?? title, isPlaying);
  }, [audioStatus?.audioLevels?.visualSpectrum, isPlaying, title, trackId]);

  const stageStyle = useMemo(
    () => ({
      '--listening-accent-rgb': coverRgb ?? '36 164 149',
      '--listening-energy': energy.toFixed(3),
      '--listening-transient': transient.toFixed(3),
      '--listening-headroom-risk': headroomRisk.toFixed(3),
      '--listening-progress': `${progressPercent}%`,
    }) as CSSProperties,
    [coverRgb, energy, headroomRisk, progressPercent, transient],
  );

  const mvAudioClock = useMemo<MvAudioClock>(
    () => ({
      positionSeconds,
      updatedAtMs: statusUpdatedAtMs,
      playbackRate,
      durationSeconds: durationSeconds > 0 ? durationSeconds : null,
      state: visualState,
    }),
    [durationSeconds, playbackRate, positionSeconds, statusUpdatedAtMs, visualState],
  );

  const runPlaybackAction = useCallback(async (action: () => Promise<PlaybackStatus | null>): Promise<void> => {
    try {
      const status = await action();
      if (status) {
        setPlaybackStatusSnapshot({ playbackStatus: status, error: null });
      }
      await refreshPlaybackStatus();
    } catch (error) {
      setPlaybackStatusSnapshot({ error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const handlePlayPause = useCallback((): void => {
    void runPlaybackAction(async () => {
      const playback = window.echo?.playback;
      if (isPlaying) {
        return playback?.pause?.() ?? null;
      }

      if ((visualState === 'idle' || visualState === 'stopped' || visualState === 'ended') && queue.currentItem) {
        return queue.playQueueItem(queue.currentItem.queueId);
      }

      if ((visualState === 'idle' || visualState === 'stopped' || visualState === 'ended') && currentTrack) {
        return queue.playTrack(currentTrack);
      }

      return playback?.play?.() ?? null;
    });
  }, [currentTrack, isPlaying, queue, runPlaybackAction, visualState]);

  const handleSeek = useCallback(
    (nextPositionSeconds: number): void => {
      if (durationSeconds <= 0) {
        return;
      }
      const safePositionSeconds = Math.max(0, Math.min(durationSeconds, nextPositionSeconds));
      void runPlaybackAction(async () => {
        const status = await window.echo?.playback?.seek?.(safePositionSeconds);
        return status ? { ...status, positionMs: Math.round(safePositionSeconds * 1000) } : null;
      });
    },
    [durationSeconds, runPlaybackAction],
  );

  const handleQueueItemPlay = useCallback(
    (queueId: string): void => {
      void runPlaybackAction(() => queue.playQueueItem(queueId));
    },
    [queue, runPlaybackAction],
  );

  return (
    <div
      className="listening-room-page"
      data-has-cover={coverUrl ? 'true' : undefined}
      data-playback-state={visualState}
      data-rail-open={isRailOpen ? 'true' : 'false'}
      style={stageStyle}
    >
      {coverUrl ? (
        <div className="listening-room-backdrop" aria-hidden="true">
          <img src={coverUrl} alt="" />
        </div>
      ) : null}
      <div className="listening-room-vignette" aria-hidden="true" />

      <header className="listening-room-header">
        <div className="listening-room-heading">
          <span>{copy.kicker}</span>
          <h1>{copy.title}</h1>
        </div>
        <div className="listening-room-header-actions">
          <span className="listening-room-state-pill" data-state={visualState}>
            <Activity size={14} aria-hidden="true" />
            {stateText}
          </span>
          <button
            type="button"
            className="listening-room-icon-button"
            aria-label={copy.actionFullscreen}
            title={copy.actionFullscreen}
            onClick={() => void window.echo?.app?.toggleFullscreen?.()}
          >
            <Maximize2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="listening-room-icon-button"
            aria-label={isRailOpen ? copy.actionHideRail : copy.actionShowRail}
            title={isRailOpen ? copy.actionHideRail : copy.actionShowRail}
            onClick={() => setIsRailOpen((current) => !current)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="listening-room-stage">
        <section className="listening-room-visual" aria-label={copy.title}>
          <div className="listening-room-main-visual">
            <div className="listening-room-cover-zone">
              <div className="listening-room-cover-halo" aria-hidden="true" />
              <div className="listening-room-cover" data-empty={!coverUrl}>
                {coverUrl ? <img src={coverUrl} alt="" /> : <Disc3 size={64} aria-hidden="true" />}
              </div>
              <div className="listening-room-track-copy">
                <span>{trackSpec}</span>
                <strong>{currentTrack || filePath ? title : copy.emptyTitle}</strong>
                <em>{artist}</em>
                {activeLyricText ? <small>{activeLyricText}</small> : null}
              </div>
            </div>

            <div className="listening-room-live-panel" data-mode={viewMode}>
              <div className="listening-room-mode-switch" role="tablist" aria-label={copy.title}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'lyrics'}
                  data-active={viewMode === 'lyrics' ? 'true' : undefined}
                  onClick={() => setViewMode('lyrics')}
                >
                  <Mic2 size={16} aria-hidden="true" />
                  {copy.modeLyrics}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'mv'}
                  data-active={viewMode === 'mv' ? 'true' : undefined}
                  onClick={() => setViewMode('mv')}
                >
                  <Film size={16} aria-hidden="true" />
                  {copy.modeMv}
                </button>
              </div>

              {viewMode === 'lyrics' ? (
                <div className="listening-room-lyrics">
                  <LyricsView
                    durationMs={durationSeconds * 1000}
                    emptyLabel={lyricsLoading ? copy.lyricsLoading : lyricsState.kind === 'instrumental' ? copy.lyricsInstrumental : copy.emptyLyrics}
                    highFrequencyUpdatesEnabled
                    lyrics={lyricsState}
                    onSeek={handleSeek}
                    playbackRate={playbackRate}
                    playbackState={visualState}
                    positionMs={positionSeconds * 1000}
                    positionUpdatedAtMs={statusUpdatedAtMs}
                    showRomanization
                    showTranslation
                    wordHighlightEnabled
                  />
                </div>
              ) : (
                <div className="listening-room-mv">
                  <MvPanel
                    artist={artist}
                    audioClock={mvAudioClock}
                    coverUrl={coverUrl}
                    currentTrack={currentTrack}
                    isAudioPlaying={isPlaying}
                    smartReadableColorsEnabled
                    streamingTarget={streamingTarget}
                    title={currentTrack || filePath ? title : copy.emptyTitle}
                    trackId={trackId}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="listening-room-spectrum" aria-hidden="true">
            {spectrum.map((value, index) => (
              <span
                key={`${index}-${Math.round(value * 100)}`}
                style={{ '--bar-level': value.toFixed(3), '--bar-index': index } as CSSProperties}
              />
            ))}
          </div>
        </section>

        <aside className="listening-room-rail" aria-label={copy.signal}>
          <section className="listening-room-rail-section">
            <div className="listening-room-rail-title">
              <MonitorSpeaker size={17} aria-hidden="true" />
              <span>{copy.output}</span>
            </div>
            <strong>{deviceName}</strong>
            <p>{routeLabel}</p>
          </section>
          <section className="listening-room-rail-section">
            <div className="listening-room-rail-title">
              <Waves size={17} aria-hidden="true" />
              <span>{copy.signal}</span>
            </div>
            <strong>{signalPath}</strong>
            <p>{audioStatus?.outputBackend ?? audioStatus?.activeOutputBackendImpl ?? routeLabel}</p>
          </section>
          <section className="listening-room-rail-section">
            <div className="listening-room-rail-title">
              <AudioLines size={17} aria-hidden="true" />
              <span>{copy.quality}</span>
            </div>
            <div className="listening-room-quality-grid">
              <span data-tone={audioStatus?.sampleRateMismatch ? 'warn' : 'good'}>
                <strong>{qualityLabel}</strong>
                <em>{copy.source}</em>
              </span>
              <span data-tone={audioStatus?.dspActive ? 'watch' : 'good'}>
                <strong>{dspLabel}</strong>
                <em>DSP</em>
              </span>
              <span data-tone={headroomRisk > 0.55 ? 'warn' : 'good'}>
                <strong>{formatDb(headroomDb, copy.unknown)}</strong>
                <em>{copy.headroom}</em>
              </span>
              <span>
                <strong>{formatRate(outputRate)}</strong>
                <em>{copy.output}</em>
              </span>
            </div>
          </section>
          <PlayerStatusChips status={audioStatus} state={visualState} track={currentTrack} />
        </aside>
      </main>

      <footer className="listening-room-console">
        <div className="listening-room-progress">
          <span>{formatTime(positionSeconds)}</span>
          <input
            aria-label={copy.signal}
            disabled={durationSeconds <= 0}
            max={Math.max(0, Math.round(durationSeconds))}
            min={0}
            onChange={(event) => handleSeek(Number(event.currentTarget.value))}
            type="range"
            value={Math.max(0, Math.round(Math.min(positionSeconds, durationSeconds || positionSeconds)))}
          />
          <span>{formatTime(durationSeconds)}</span>
        </div>

        <div className="listening-room-transport" aria-label={copy.title}>
          <button
            type="button"
            className="listening-room-transport-button"
            aria-label={copy.actionPrevious}
            title={copy.actionPrevious}
            disabled={!queue.canGoPrevious}
            onClick={() => void runPlaybackAction(queue.playPrevious)}
          >
            <SkipBack size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="listening-room-play-button"
            aria-label={isPlaying ? copy.actionPause : copy.actionPlay}
            title={isPlaying ? copy.actionPause : copy.actionPlay}
            disabled={!hasPlayableTarget}
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause size={28} aria-hidden="true" /> : <Play size={30} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="listening-room-transport-button"
            aria-label={copy.actionNext}
            title={copy.actionNext}
            disabled={!queue.canGoNext}
            onClick={() => void runPlaybackAction(queue.playNext)}
          >
            <SkipForward size={20} aria-hidden="true" />
          </button>
        </div>

        <section className="listening-room-queue" aria-label={copy.queue}>
          <div className="listening-room-queue-title">
            <ListMusic size={16} aria-hidden="true" />
            <span>{copy.queue}</span>
          </div>
          {queuePreviewItems.length > 0 ? (
            <div className="listening-room-queue-list">
              {queuePreviewItems.map((item, index) => {
                const isCurrent = queue.currentQueueId ? item.queueId === queue.currentQueueId : item.track.id === queue.currentTrackId;
                const itemCover = artworkUrlForTrack(item.track);
                return (
                  <button
                    type="button"
                    className="listening-room-queue-item"
                    data-current={isCurrent ? 'true' : undefined}
                    key={item.queueId}
                    onClick={() => handleQueueItemPlay(item.queueId)}
                  >
                    <span className="listening-room-queue-cover" data-empty={!itemCover}>
                      {itemCover ? <img src={itemCover} alt="" /> : <Disc3 size={16} aria-hidden="true" />}
                    </span>
                    <span className="listening-room-queue-copy">
                      <strong>{item.track.title}</strong>
                      <em>{item.track.artist || item.track.albumArtist || copy.unknown}</em>
                    </span>
                    <span className="listening-room-queue-meta">{isCurrent ? copy.now : index === 0 ? copy.queueNext : formatTime(item.track.duration)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="listening-room-queue-empty">{copy.emptyQueue}</p>
          )}
        </section>
      </footer>
    </div>
  );
};
