import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Check,
  ChevronDown,
  Clapperboard,
  Database,
  ExternalLink,
  FileVideo,
  FolderOpen,
  Globe2,
  GripVertical,
  MonitorPlay,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { MvMatchCandidate, MvProviderId, MvQualityVariant, MvSettings, NetworkMvProviderId, TrackVideo } from '../../../shared/types/mv';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlaybackQueue } from '../../stores/PlaybackQueueProvider';

type MvSettingsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

const drawerExitAnimationMs = 320;
const formatScore = (score: number): string => `${Math.round(score * 100)}%`;

const fallbackSettings: MvSettings = {
  autoSearch: true,
  enabledProviders: ['bilibili', 'youtube'],
  providerOrder: ['bilibili', 'youtube'],
  maxQuality: '1080p',
  allow60fps: true,
};

const providerLabels: Record<NetworkMvProviderId, string> = {
  bilibili: 'Bilibili',
  youtube: 'YouTube',
};

const qualityCaps: MvSettings['maxQuality'][] = ['720p', '1080p', '1440p', '2160p', 'max'];

const qualityLabel = (variant: Pick<MvQualityVariant, 'label' | 'fps'>): string =>
  variant.fps && variant.fps >= 55 && !variant.label.includes('60') ? `${variant.label} 60fps` : variant.label;

const videoToCandidate = (video: TrackVideo): MvMatchCandidate => ({
  id: video.id,
  provider: video.provider,
  sourceType: video.sourceType,
  title: video.title ?? video.sourceId ?? video.id,
  artist: video.artist,
  filePath: video.filePath,
  url: video.url,
  providerUrl: video.providerUrl,
  thumbnailUrl: video.thumbnailUrl,
  uploader: null,
  availableQualities: [],
  durationSeconds: video.durationSeconds,
  score: video.score,
  playableInApp: video.playableInApp,
  reasons: [],
});

export const MvSettingsDrawer = ({ isOpen, onClose }: MvSettingsDrawerProps): JSX.Element | null => {
  const { t } = useI18n();
  const queue = usePlaybackQueue();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isMotionOpen, setIsMotionOpen] = useState(false);
  const [fallbackTrackId, setFallbackTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MvSettings>(fallbackSettings);
  const [selectedVideo, setSelectedVideo] = useState<TrackVideo | null>(null);
  const [streamVariants, setStreamVariants] = useState<MvQualityVariant[]>([]);
  const [candidates, setCandidates] = useState<MvMatchCandidate[]>([]);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaxQualityMenuOpen, setIsMaxQualityMenuOpen] = useState(false);
  const [isSelectedQualityMenuOpen, setIsSelectedQualityMenuOpen] = useState(false);
  const [draggedProvider, setDraggedProvider] = useState<NetworkMvProviderId | null>(null);
  const [dragOverProvider, setDragOverProvider] = useState<NetworkMvProviderId | null>(null);

  const activeTrackId = queue.currentTrackId ?? fallbackTrackId;
  const activeTrackTitle = useMemo(() => {
    const track =
      queue.currentTrack ??
      (activeTrackId ? queue.tracks.find((item) => item.id === activeTrackId) ?? null : null) ??
      (queue.lastPlayedTrack?.id === activeTrackId ? queue.lastPlayedTrack : null);

    return track ? `${track.title} - ${track.artist || track.albumArtist}` : activeTrackId ? activeTrackId : t('mvSettings.status.noActiveTrack');
  }, [activeTrackId, queue.currentTrack, queue.lastPlayedTrack, queue.tracks, t]);

  const qualityLabels = useMemo<Record<MvSettings['maxQuality'], string>>(
    () => ({
      '720p': '720p',
      '1080p': '1080p',
      '1440p': '1440p',
      '2160p': '4K',
      max: t('mvSettings.quality.max'),
    }),
    [t],
  );

  const providerLabel = useCallback(
    (provider: MvProviderId): string => {
      if (provider === 'local') {
        return t('mvSettings.provider.local');
      }

      if (provider === 'bilibili' || provider === 'youtube') {
        return providerLabels[provider];
      }

      return provider;
    },
    [t],
  );

  const providerLabelForVideo = useCallback(
    (video: TrackVideo | null): string => {
      if (!video) {
        return t('mvSettings.status.none');
      }

      return providerLabel(video.provider);
    },
    [providerLabel, t],
  );

  const enabledProviders = new Set(settings.enabledProviders);
  const selectedQualityLabel = useMemo(() => {
    if (!selectedVideo || !selectedVideo.selectedQualityId || selectedVideo.selectedQualityId === 'auto') {
      return t('mvSettings.status.auto');
    }

    const variant = streamVariants.find((item) => item.id === selectedVideo.selectedQualityId);
    return variant ? qualityLabel(variant) : selectedVideo.qualityLabel ?? t('mvSettings.status.auto');
  }, [selectedVideo, streamVariants, t]);

  const notifyMvChanged = useCallback((trackId: string): void => {
    window.dispatchEvent(new CustomEvent('mv:changed', { detail: { trackId } }));
  }, []);

  const resolveSelectedStreams = useCallback(async (video: TrackVideo | null): Promise<TrackVideo | null> => {
    if (!video || video.provider === 'local' || !window.echo?.mv?.resolveStreams) {
      setStreamVariants([]);
      return video;
    }

    try {
      const resolved = await window.echo.mv.resolveStreams(video.id);
      setStreamVariants(resolved.variants);
      return resolved.video;
    } catch {
      setStreamVariants([]);
      return video;
    }
  }, []);

  const loadSettings = useCallback(async (): Promise<void> => {
    if (!window.echo?.mv?.getSettings) {
      return;
    }

    try {
      setSettings(await window.echo.mv.getSettings());
    } catch {
      setSettings(fallbackSettings);
    }
  }, []);

  const loadCurrentMv = useCallback(
    async (trackId: string | null): Promise<void> => {
      if (!trackId || !window.echo?.mv) {
        setSelectedVideo(null);
        setStreamVariants([]);
        setCandidates([]);
        return;
      }

      try {
        setError(null);
        setCandidates([]);
        const video = await window.echo.mv.getSelected(trackId);
        setSelectedVideo(await resolveSelectedStreams(video));
        const savedCandidates = await window.echo.mv.getCandidates?.(trackId);
        if (savedCandidates) {
          setCandidates(savedCandidates.filter((candidate) => !candidate.selected).map(videoToCandidate));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    },
    [resolveSelectedStreams],
  );

  const refreshActiveTrack = useCallback(async (): Promise<string | null> => {
    if (queue.currentTrackId) {
      return queue.currentTrackId;
    }

    try {
      const [playbackStatus, audioStatus] = await Promise.all([
        window.echo?.playback?.getStatus?.().catch(() => null),
        window.echo?.audio?.getStatus?.().catch(() => null),
      ]);
      const trackId = playbackStatus?.currentTrackId ?? audioStatus?.currentTrackId ?? null;
      setFallbackTrackId(trackId);
      return trackId;
    } catch {
      return null;
    }
  }, [queue.currentTrackId]);

  const patchSettings = useCallback(
    async (patch: Partial<MvSettings>): Promise<void> => {
      const optimistic = { ...settings, ...patch };
      setSettings(optimistic);

      try {
        if (window.echo?.mv?.setSettings) {
          setSettings(await window.echo.mv.setSettings(patch));
        }
      } catch (settingsError) {
        setSettings(settings);
        setError(settingsError instanceof Error ? settingsError.message : String(settingsError));
      }
    },
    [settings],
  );

  const toggleProvider = useCallback(
    (provider: NetworkMvProviderId): void => {
      const next = enabledProviders.has(provider)
        ? settings.enabledProviders.filter((item) => item !== provider)
        : [...settings.enabledProviders, provider];
      void patchSettings({ enabledProviders: next });
    },
    [enabledProviders, patchSettings, settings.enabledProviders],
  );

  const chooseMaxQuality = useCallback(
    (quality: MvSettings['maxQuality']): void => {
      setIsMaxQualityMenuOpen(false);
      void patchSettings({ maxQuality: quality });
    },
    [patchSettings],
  );

  const toggleAutoSearch = useCallback(async (): Promise<void> => {
    const nextAutoSearch = !settings.autoSearch;
    await patchSettings({ autoSearch: nextAutoSearch });
    if (nextAutoSearch) {
      const trackId = await refreshActiveTrack();
      if (trackId && window.echo?.mv?.searchNetworkCandidates) {
        setIsBusy(true);
        setError(null);
        try {
          const nextCandidates = await window.echo.mv.searchNetworkCandidates(trackId);
          setCandidates(nextCandidates);
          if (nextCandidates.length === 0) {
            setError(t('mvSettings.error.noNetworkCandidates'));
          }
        } catch (searchError) {
          setError(searchError instanceof Error ? searchError.message : String(searchError));
        } finally {
          setIsBusy(false);
        }
      }
    }
  }, [patchSettings, refreshActiveTrack, settings.autoSearch, t]);

  const reorderProvider = useCallback(
    (provider: NetworkMvProviderId, targetProvider: NetworkMvProviderId): void => {
      const index = settings.providerOrder.indexOf(provider);
      const targetIndex = settings.providerOrder.indexOf(targetProvider);
      if (index < 0 || targetIndex < 0 || index === targetIndex) {
        return;
      }

      const next = [...settings.providerOrder];
      const [item] = next.splice(index, 1);
      if (!item) {
        return;
      }
      next.splice(targetIndex, 0, item);
      void patchSettings({ providerOrder: next });
    },
    [patchSettings, settings.providerOrder],
  );

  const handleProviderDragStart = useCallback((event: DragEvent<HTMLElement>, provider: NetworkMvProviderId): void => {
    setDraggedProvider(provider);
    setDragOverProvider(provider);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', provider);
  }, []);

  const handleProviderDragOver = useCallback(
    (event: DragEvent<HTMLElement>, provider: NetworkMvProviderId): void => {
      if (!draggedProvider || draggedProvider === provider) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverProvider(provider);
    },
    [draggedProvider],
  );

  const handleProviderDrop = useCallback(
    (event: DragEvent<HTMLElement>, provider: NetworkMvProviderId): void => {
      event.preventDefault();
      const droppedProvider = draggedProvider ?? (event.dataTransfer.getData('text/plain') as NetworkMvProviderId);
      setDraggedProvider(null);
      setDragOverProvider(null);
      reorderProvider(droppedProvider, provider);
    },
    [draggedProvider, reorderProvider],
  );

  const handleProviderDragEnd = useCallback((): void => {
    setDraggedProvider(null);
    setDragOverProvider(null);
  }, []);

  const findLocalCandidates = useCallback(async (): Promise<void> => {
    const trackId = await refreshActiveTrack();
    if (!trackId || !window.echo?.mv) {
      setError(t('mvSettings.error.noActiveTrackMatching'));
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const nextCandidates = await window.echo.mv.findLocalCandidates(trackId);
      setCandidates(nextCandidates);
      setSelectedVideo(await resolveSelectedStreams(await window.echo.mv.getSelected(trackId)));
      if (nextCandidates.length === 0) {
        setError(t('mvSettings.error.noLocalCandidates'));
      }
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : String(findError));
    } finally {
      setIsBusy(false);
    }
  }, [refreshActiveTrack, resolveSelectedStreams, t]);

  const searchNetworkCandidates = useCallback(async (): Promise<void> => {
    const trackId = await refreshActiveTrack();
    if (!trackId || !window.echo?.mv?.searchNetworkCandidates) {
      setError(t('mvSettings.error.noActiveTrackNetworkSearch'));
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const nextCandidates = await window.echo.mv.searchNetworkCandidates(trackId);
      setCandidates(nextCandidates);
      if (nextCandidates.length === 0) {
        setError(t('mvSettings.error.noNetworkCandidates'));
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setIsBusy(false);
    }
  }, [refreshActiveTrack, t]);

  const chooseLocalVideo = useCallback(async (): Promise<void> => {
    const trackId = await refreshActiveTrack();
    if (!trackId || !window.echo?.mv) {
      setError(t('mvSettings.error.noActiveTrackBinding'));
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const video = await window.echo.mv.chooseLocalVideo(trackId);
      if (video) {
        setSelectedVideo(video);
        setStreamVariants([]);
        setCandidates([]);
        notifyMvChanged(trackId);
      }
    } catch (chooseError) {
      setError(chooseError instanceof Error ? chooseError.message : String(chooseError));
    } finally {
      setIsBusy(false);
    }
  }, [notifyMvChanged, refreshActiveTrack, t]);

  const selectCandidate = useCallback(
    async (candidateId: string): Promise<void> => {
      const trackId = await refreshActiveTrack();
      if (!trackId || !window.echo?.mv) {
        setError(t('mvSettings.error.noActiveTrackBinding'));
        return;
      }

      setBusyCandidateId(candidateId);
      setError(null);
      try {
        const video = await window.echo.mv.selectVideo(trackId, candidateId);
        setSelectedVideo(await resolveSelectedStreams(video));
        setCandidates([]);
        notifyMvChanged(trackId);
      } catch (selectError) {
        setError(selectError instanceof Error ? selectError.message : String(selectError));
      } finally {
        setBusyCandidateId(null);
      }
    },
    [notifyMvChanged, refreshActiveTrack, resolveSelectedStreams, t],
  );

  const clearSelected = useCallback(async (): Promise<void> => {
    const trackId = await refreshActiveTrack();
    if (!trackId || !window.echo?.mv) {
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await window.echo.mv.clearSelected(trackId);
      setSelectedVideo(null);
      setStreamVariants([]);
      notifyMvChanged(trackId);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setIsBusy(false);
    }
  }, [notifyMvChanged, refreshActiveTrack]);

  const openExternal = useCallback(async (): Promise<void> => {
    if (!selectedVideo || !window.echo?.mv) {
      return;
    }

    setError(null);
    try {
      await window.echo.mv.openExternal(selectedVideo.id);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }, [selectedVideo]);

  const setQuality = useCallback(
    async (qualityId: string): Promise<void> => {
      if (!selectedVideo || !window.echo?.mv?.setQuality) {
        return;
      }

      setError(null);
      try {
        const video = await window.echo.mv.setQuality(selectedVideo.id, qualityId);
        setSelectedVideo(await resolveSelectedStreams(video));
        if (activeTrackId) {
          notifyMvChanged(activeTrackId);
        }
      } catch (qualityError) {
        setError(qualityError instanceof Error ? qualityError.message : String(qualityError));
      }
    },
    [activeTrackId, notifyMvChanged, resolveSelectedStreams, selectedVideo],
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setIsMotionOpen(true));
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }

    setIsMotionOpen(false);
    setIsMaxQualityMenuOpen(false);
    setIsSelectedQualityMenuOpen(false);
    if (!shouldRender) {
      return undefined;
    }

    const timer = window.setTimeout(() => setShouldRender(false), drawerExitAnimationMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadSettings();
    void refreshActiveTrack().then((trackId) => loadCurrentMv(trackId));
  }, [isOpen, loadCurrentMv, loadSettings, refreshActiveTrack]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleCandidatesChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ trackId?: string; candidates?: MvMatchCandidate[] }>).detail;
      if (!detail?.trackId || detail.trackId !== activeTrackId || !Array.isArray(detail.candidates)) {
        return;
      }

      setCandidates(detail.candidates);
      setError(detail.candidates.length === 0 ? t('mvSettings.error.noNetworkCandidates') : null);
    };

    window.addEventListener('mv:candidatesChanged', handleCandidatesChanged);
    return () => window.removeEventListener('mv:candidatesChanged', handleCandidatesChanged);
  }, [activeTrackId, isOpen, t]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="audio-drawer-root mv-settings-drawer-root no-drag" role="presentation" data-open={isMotionOpen}>
      <button className="audio-drawer-scrim" type="button" aria-label={t('mvSettings.action.close')} onClick={onClose} />
      <aside className="audio-drawer mv-settings-drawer" aria-label={t('mvSettings.aria.drawer')}>
        <header className="audio-drawer-header">
          <div>
            <Clapperboard size={18} />
            <h2>{t('mvSettings.title')}</h2>
          </div>
          <button className="audio-drawer-close" type="button" aria-label={t('mvSettings.action.close')} title={t('mvSettings.action.close')} onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <section className="audio-engine-meter mv-engine-meter" aria-label={t('mvSettings.aria.engineStatus')}>
          <div className="audio-engine-meter__top">
            <span className="audio-engine-meter__icon">
              <MonitorPlay size={17} />
            </span>
            <div>
              <span>{t('mvSettings.engine.title')}</span>
              <strong>{activeTrackTitle}</strong>
            </div>
            <ShieldCheck size={15} />
          </div>
          <div className="audio-engine-meter__grid">
            <span>
              <em>{t('mvSettings.engine.selected')}</em>
              <strong>{providerLabelForVideo(selectedVideo)}</strong>
            </span>
            <span>
              <em>{t('mvSettings.engine.quality')}</em>
              <strong>{selectedVideo?.qualityLabel ?? (selectedVideo ? t('mvSettings.status.auto') : t('mvSettings.status.none'))}</strong>
            </span>
            <span>
              <em>{t('mvSettings.engine.network')}</em>
              <strong>{settings.autoSearch ? t('mvSettings.status.auto') : settings.enabledProviders.length ? t('mvSettings.status.on') : t('mvSettings.status.off')}</strong>
            </span>
          </div>
          <div className="audio-engine-meter__badges">
            <em data-tone="ready">{t('mvSettings.badge.proxyOnly')}</em>
            <em data-tone="ready">{t('mvSettings.badge.credentialsMain')}</em>
          </div>
        </section>

        <section className="audio-drawer-section audio-drawer-options audio-drawer-options--open">
          <div className="audio-drawer-section-title">
            <Database size={17} />
            <h3>{t('mvSettings.binding.title')}</h3>
          </div>
          <div className="mv-settings-actions">
            <button type="button" onClick={() => void findLocalCandidates()} disabled={isBusy}>
              <Search size={15} />
              {t('mvSettings.action.findLocal')}
            </button>
            <button type="button" onClick={() => void searchNetworkCandidates()} disabled={isBusy}>
              <Globe2 size={15} />
              {t('mvSettings.action.searchNetwork')}
            </button>
            <button type="button" onClick={() => void chooseLocalVideo()} disabled={isBusy}>
              <FolderOpen size={15} />
              {t('mvSettings.action.chooseFile')}
            </button>
            <button type="button" onClick={() => void loadCurrentMv(activeTrackId)} disabled={isBusy}>
              <RotateCcw size={15} />
              {t('mvSettings.action.refresh')}
            </button>
          </div>

          {selectedVideo ? (
            <div className="mv-selected-card">
              <span>
                <strong>{selectedVideo.title ?? t('mvSettings.binding.selectedMv')}</strong>
                <em>
                  {providerLabelForVideo(selectedVideo)}
                  {selectedVideo.qualityLabel ? ` / ${selectedVideo.qualityLabel}` : ''}
                  {selectedVideo.fps && selectedVideo.fps >= 55 ? ' / 60fps' : ''}
                </em>
              </span>
              <div>
                {!selectedVideo.playableInApp || selectedVideo.provider !== 'local' ? (
                  <button type="button" aria-label={t('mvSettings.action.openExternal')} title={t('mvSettings.action.openExternal')} onClick={() => void openExternal()}>
                    <ExternalLink size={15} />
                  </button>
                ) : null}
                <button type="button" aria-label={t('mvSettings.action.removeSelected')} title={t('mvSettings.action.removeSelected')} onClick={() => void clearSelected()}>
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : null}

          {selectedVideo && selectedVideo.provider !== 'local' && streamVariants.length > 0 ? (
            <div className="mv-quality-picker">
              <SlidersHorizontal size={15} />
              <div className="mv-quality-menu">
                <button
                  type="button"
                  className="mv-quality-trigger"
                  aria-expanded={isSelectedQualityMenuOpen}
                  aria-label={t('mvSettings.aria.selectedQuality', { quality: selectedQualityLabel })}
                  onClick={() => setIsSelectedQualityMenuOpen((current) => !current)}
                >
                  <span>{selectedQualityLabel}</span>
                  <ChevronDown size={15} />
                </button>
                {isSelectedQualityMenuOpen ? (
                  <div className="mv-quality-popover" role="menu" aria-label={t('mvSettings.aria.selectedQualityOptions')}>
                    <button
                      type="button"
                      role="menuitem"
                      data-selected={!selectedVideo.selectedQualityId || selectedVideo.selectedQualityId === 'auto'}
                      onClick={() => {
                        setIsSelectedQualityMenuOpen(false);
                        void setQuality('auto');
                      }}
                    >
                      <span>{t('mvSettings.status.auto')}</span>
                      {!selectedVideo.selectedQualityId || selectedVideo.selectedQualityId === 'auto' ? <Check size={13} /> : null}
                    </button>
                    {streamVariants.map((variant) => (
                      <button
                        type="button"
                        key={variant.id}
                        role="menuitem"
                        data-selected={selectedVideo.selectedQualityId === variant.id}
                        disabled={!variant.playableInApp}
                        onClick={() => {
                          setIsSelectedQualityMenuOpen(false);
                          void setQuality(variant.id);
                        }}
                      >
                        <span>{qualityLabel(variant)}</span>
                        {selectedVideo.selectedQualityId === variant.id ? <Check size={13} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {candidates.length > 0 ? (
            <div className="mv-settings-candidates" aria-label={t('mvSettings.aria.candidates')}>
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className="mv-settings-candidate"
                  disabled={busyCandidateId !== null}
                  onClick={() => void selectCandidate(candidate.id)}
                >
                  <span className="mv-candidate-thumb" aria-hidden="true">
                    {candidate.thumbnailUrl ? <img alt="" draggable={false} src={candidate.thumbnailUrl} /> : <FileVideo size={16} />}
                  </span>
                  <span>
                    <strong>{candidate.title}</strong>
                    <em>{candidate.uploader ?? (candidate.reasons.slice(0, 3).join(' / ') || providerLabel(candidate.provider))}</em>
                  </span>
                  <small>{providerLabel(candidate.provider)}</small>
                  <small>{formatScore(candidate.score)}</small>
                  <small>{candidate.playableInApp ? t('mvSettings.candidate.inApp') : t('mvSettings.candidate.external')}</small>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className={`audio-drawer-section audio-drawer-options audio-drawer-options--open${isMaxQualityMenuOpen ? ' mv-section-menu-open' : ''}`}>
          <div className="audio-drawer-section-title">
            <Globe2 size={17} />
            <h3>{t('mvSettings.network.title')}</h3>
          </div>
          <button type="button" className="mv-source-toggle mv-auto-apply-toggle" aria-pressed={settings.autoSearch} onClick={() => void toggleAutoSearch()}>
            <span className="mv-check-mark">{settings.autoSearch ? <Check size={14} /> : null}</span>
            <span className="mv-toggle-copy">
              <strong>{t('mvSettings.network.autoApply')}</strong>
              <em>{settings.autoSearch ? t('mvSettings.status.on') : t('mvSettings.status.off')}</em>
            </span>
          </button>
          <div className="mv-source-list" role="list" aria-label={t('mvSettings.aria.networkSources')}>
            {settings.providerOrder.map((provider, index) => (
              <div
                className="mv-source-row"
                key={provider}
                role="listitem"
                data-dragging={draggedProvider === provider}
                data-drop-target={draggedProvider !== provider && dragOverProvider === provider}
                onDragOver={(event) => handleProviderDragOver(event, provider)}
                onDrop={(event) => handleProviderDrop(event, provider)}
              >
                <span
                  className="mv-source-drag-handle"
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={t('mvSettings.action.dragSource', { provider: providerLabels[provider] })}
                  title={t('mvSettings.action.dragReorder')}
                  onDragStart={(event) => handleProviderDragStart(event, provider)}
                  onDragEnd={handleProviderDragEnd}
                >
                  <GripVertical size={16} />
                  <small>{index + 1}</small>
                </span>
                <button type="button" className="mv-source-toggle" aria-pressed={enabledProviders.has(provider)} onClick={() => toggleProvider(provider)}>
                  <span className="mv-check-mark">{enabledProviders.has(provider) ? <Check size={14} /> : null}</span>
                  {providerLabels[provider]}
                </button>
              </div>
            ))}
          </div>
          <div className="mv-quality-controls">
            <div className="mv-quality-menu">
              <span className="mv-field-label">{t('mvSettings.network.maxQuality')}</span>
              <button
                type="button"
                className="mv-quality-trigger"
                aria-expanded={isMaxQualityMenuOpen}
                aria-label={t('mvSettings.aria.maxQuality', { quality: qualityLabels[settings.maxQuality] })}
                onClick={() => setIsMaxQualityMenuOpen((current) => !current)}
              >
                <span>{qualityLabels[settings.maxQuality]}</span>
                <ChevronDown size={15} />
              </button>
              {isMaxQualityMenuOpen ? (
                <div className="mv-quality-popover" role="menu" aria-label={t('mvSettings.aria.maxQualityOptions')}>
                  {qualityCaps.map((quality) => (
                    <button type="button" key={quality} role="menuitem" data-selected={settings.maxQuality === quality} onClick={() => chooseMaxQuality(quality)}>
                      <span>{qualityLabels[quality]}</span>
                      {settings.maxQuality === quality ? <Check size={13} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {error ? <p className="audio-drawer-error">{error}</p> : null}
      </aside>
    </div>
  );
};
