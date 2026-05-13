// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { TrackVideo } from '../../../shared/types/mv';
import { MvPanel } from './MvPanel';

const makeVideo = (overrides: Partial<TrackVideo> = {}): TrackVideo => ({
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
  ...overrides,
});

const renderPanel = (selected: TrackVideo | null, isAudioPlaying = true) => {
  window.echo = {
    mv: {
      getSelected: vi.fn().mockResolvedValue(selected),
      getSettings: vi.fn(),
      setSettings: vi.fn(),
      findLocalCandidates: vi.fn().mockResolvedValue([]),
      searchNetworkCandidates: vi.fn().mockResolvedValue([]),
      getCandidates: vi.fn().mockResolvedValue([]),
      resolveStreams: vi.fn().mockResolvedValue({ video: selected, variants: [] }),
      setQuality: vi.fn(),
      chooseLocalVideo: vi.fn().mockResolvedValue(null),
      bindLocalVideo: vi.fn(),
      selectVideo: vi.fn(),
      clearSelected: vi.fn(),
      openExternal: vi.fn(),
    },
  } as unknown as Window['echo'];

  return render(
    <MvPanel
      trackId="track-1"
      title="Test Song"
      artist="Test Artist"
      coverUrl="echo-cover://thumb/test"
      isAudioPlaying={isAudioPlaying}
    />,
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MvPanel', () => {
  it('shows cover fallback when no MV is selected', async () => {
    const { container } = renderPanel(null);

    await waitFor(() => expect(window.echo.mv.getSelected).toHaveBeenCalledWith('track-1'));
    expect(container.querySelector('.lyrics-mv-card[data-cover="true"] .lyrics-mv-artwork img')?.getAttribute('src')).toBe(
      'echo-cover://thumb/test',
    );
    expect(screen.getByText('MV unavailable')).toBeTruthy();
    expect(screen.queryByText('Find local')).toBeNull();
    expect(screen.queryByText('Choose file')).toBeNull();
  });

  it('shows a video for playable selected MV', async () => {
    const { container } = renderPanel(makeVideo());

    await waitFor(() => expect(container.querySelector('video')?.getAttribute('src')).toBe('echo-video://mv/video-1'));
    const video = container.querySelector('video') as HTMLVideoElement | null;
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.controls).toBe(false);
    expect(container.querySelector('.lyrics-mv-toolbar')).toBeNull();
  });

  it('pauses the MV when audio playback pauses', async () => {
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const { container, rerender } = renderPanel(makeVideo(), true);

    await waitFor(() => expect(container.querySelector('video')?.getAttribute('src')).toBe('echo-video://mv/video-1'));

    rerender(
      <MvPanel
        trackId="track-1"
        title="Test Song"
        artist="Test Artist"
        coverUrl="echo-cover://thumb/test"
        isAudioPlaying={false}
      />,
    );

    await waitFor(() => expect(pauseSpy).toHaveBeenCalled());
    expect(playSpy).toHaveBeenCalled();
  });

  it('shows fallback for selected MV that cannot play in app', async () => {
    renderPanel(makeVideo({ playableInApp: false, mediaUrl: null, mimeType: 'video/x-matroska' }));

    expect(await screen.findByText('External player required')).toBeTruthy();
  });

  it('refreshes when the MV binding changes elsewhere', async () => {
    renderPanel(null);

    await waitFor(() => expect(window.echo.mv.getSelected).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new CustomEvent('mv:changed', { detail: { trackId: 'track-1' } }));

    await waitFor(() => expect(window.echo.mv.getSelected).toHaveBeenCalledTimes(2));
  });
});
