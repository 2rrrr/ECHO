// @vitest-environment jsdom
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryTrack } from '../../../shared/types/library';
import type { MvMatchCandidate, MvSettings, TrackVideo } from '../../../shared/types/mv';
import { I18nProvider } from '../../i18n/I18nProvider';
import { PlaybackQueueProvider, usePlaybackQueue } from '../../stores/PlaybackQueueProvider';
import { MvSettingsDrawer } from './MvSettingsDrawer';

const makeTrack = (): LibraryTrack => ({
  id: 'track-1',
  path: 'D:\\Music\\song.flac',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  albumArtist: 'Test Artist',
  trackNo: 1,
  discNo: 1,
  year: 2026,
  genre: null,
  duration: 180,
  codec: 'flac',
  sampleRate: 44100,
  bitDepth: 16,
  bitrate: null,
  coverId: null,
  coverThumb: null,
  fieldSources: {},
});

const makeVideo = (): TrackVideo => ({
  id: 'video-1',
  trackId: 'track-1',
  provider: 'local',
  sourceType: 'manual',
  sourceId: 'local:1',
  title: 'Test Song MV',
  artist: 'Test Artist',
  url: null,
  providerUrl: null,
  thumbnailUrl: null,
  filePath: null,
  mediaUrl: 'echo-video://mv/video-1',
  mimeType: 'video/mp4',
  durationSeconds: null,
  width: null,
  height: null,
  selectedQualityId: null,
  qualityLabel: null,
  fps: null,
  score: 1,
  selected: true,
  playableInApp: true,
  rawProviderJson: null,
  createdAt: '2026-05-13T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
});

const makeCandidate = (): MvMatchCandidate => ({
  id: 'candidate-1',
  provider: 'local',
  sourceType: 'sidecar',
  title: 'Test Song',
  artist: 'Test Artist',
  filePath: null,
  url: null,
  providerUrl: null,
  thumbnailUrl: null,
  uploader: null,
  availableQualities: [],
  durationSeconds: null,
  score: 0.95,
  playableInApp: true,
  reasons: ['same basename'],
});

const defaultMvSettings: MvSettings = {
  autoSearch: true,
  enabledProviders: ['bilibili', 'youtube'],
  providerOrder: ['bilibili', 'youtube'],
  maxQuality: '1080p',
  allow60fps: true,
};

const QueueSeed = ({ children, track }: { children: JSX.Element; track: LibraryTrack }): JSX.Element => {
  const { replaceQueue, setCurrentTrackId } = usePlaybackQueue();

  useEffect(() => {
    replaceQueue([track]);
    setCurrentTrackId(track.id);
  }, [replaceQueue, setCurrentTrackId, track]);

  return children;
};

const renderDrawer = (settings: MvSettings = defaultMvSettings) => {
  const track = makeTrack();
  window.localStorage.setItem('echo-next.locale', 'en-US');
  window.echo = {
    mv: {
      getSelected: vi.fn().mockResolvedValue(null),
      getSettings: vi.fn().mockResolvedValue(settings),
      setSettings: vi.fn().mockImplementation(async (patch: Partial<MvSettings>) => ({ ...settings, ...patch })),
      findLocalCandidates: vi.fn().mockResolvedValue([makeCandidate()]),
      searchNetworkCandidates: vi.fn().mockResolvedValue([]),
      getCandidates: vi.fn().mockResolvedValue([]),
      resolveStreams: vi.fn().mockResolvedValue({ video: makeVideo(), variants: [] }),
      setQuality: vi.fn(),
      chooseLocalVideo: vi.fn().mockResolvedValue(makeVideo()),
      bindLocalVideo: vi.fn(),
      selectVideo: vi.fn().mockResolvedValue(makeVideo()),
      clearSelected: vi.fn(),
      openExternal: vi.fn(),
    },
  } as unknown as Window['echo'];

  return render(
    <I18nProvider>
      <PlaybackQueueProvider>
        <QueueSeed track={track}>
          <MvSettingsDrawer isOpen onClose={vi.fn()} />
        </QueueSeed>
      </PlaybackQueueProvider>
    </I18nProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MvSettingsDrawer', () => {
  it('contains the MV find and choose actions', async () => {
    renderDrawer();

    expect(await screen.findByRole('button', { name: /Find local/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Choose file/ })).toBeTruthy();
  });

  it('finds local candidates from the drawer', async () => {
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Find local/ }));

    await waitFor(() => expect(window.echo.mv.findLocalCandidates).toHaveBeenCalledWith('track-1'));
    expect(await screen.findByText('same basename')).toBeTruthy();
  });

  it('chooses a local MV file from the drawer', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Choose file/ }));

    await waitFor(() => expect(window.echo.mv.chooseLocalVideo).toHaveBeenCalledWith('track-1'));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mv:changed' }));
  });

  it('updates the max network quality from the drawer menu', async () => {
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Max quality 1080p/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Max' }));

    await waitFor(() => expect(window.echo.mv.setSettings).toHaveBeenCalledWith({ maxQuality: 'max' }));
  });

  it('toggles automatic MV search from the drawer', async () => {
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Auto search network MV/ }));

    await waitFor(() => expect(window.echo.mv.setSettings).toHaveBeenCalledWith({ autoSearch: false }));
  });

  it('reorders network sources by dragging the priority handle', async () => {
    renderDrawer();

    const dragData = {
      effectAllowed: '',
      dropEffect: '',
      getData: vi.fn(() => 'bilibili'),
      setData: vi.fn(),
    };

    const youtubeRow = screen.getByRole('button', { name: 'YouTube' }).closest('.mv-source-row');
    expect(youtubeRow).toBeTruthy();

    fireEvent.dragStart(await screen.findByRole('button', { name: /Drag Bilibili/ }), { dataTransfer: dragData });
    fireEvent.dragOver(youtubeRow as Element, { dataTransfer: dragData });
    fireEvent.drop(youtubeRow as Element, { dataTransfer: dragData });

    await waitFor(() => expect(window.echo.mv.setSettings).toHaveBeenCalledWith({ providerOrder: ['youtube', 'bilibili'] }));
  });

  it('refreshes the current MV when automatic MV search is enabled', async () => {
    renderDrawer({ ...defaultMvSettings, autoSearch: false });

    fireEvent.click(await screen.findByRole('button', { name: /Auto search network MV/ }));

    await waitFor(() => expect(window.echo.mv.setSettings).toHaveBeenCalledWith({ autoSearch: true }));
    await waitFor(() => expect(window.echo.mv.searchNetworkCandidates).toHaveBeenCalledWith('track-1'));
  });
});
