// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryPage, LibraryTrack } from '../../shared/types/library';

vi.mock('../components/library/TrackList', () => ({
  TrackList: ({
    tracks,
    onPlay,
  }: {
    tracks: LibraryTrack[];
    onPlay?: (track: LibraryTrack) => void;
  }) => (
    <div>
      {tracks.map((track) => (
        <button key={track.id} type="button" onClick={() => onPlay?.(track)}>
          {track.title}
        </button>
      ))}
    </div>
  ),
}));

const renderSongsPage = async (): Promise<void> => {
  const { SongsPage } = await import('./SongsPage');
  render(<SongsPage />);
};

const makeTrack = (overrides: Partial<LibraryTrack> = {}): LibraryTrack => ({
  id: 'track-1',
  path: 'D:\\Music\\Song.flac',
  title: 'Song One',
  artist: 'Artist',
  album: 'Album',
  albumArtist: 'Album Artist',
  trackNo: 1,
  discNo: 1,
  year: 2026,
  genre: null,
  duration: 180,
  codec: 'flac',
  sampleRate: 44100,
  bitDepth: 16,
  bitrate: 900000,
  coverId: null,
  coverThumb: null,
  fieldSources: {},
  ...overrides,
});

const makePage = (items: LibraryTrack[]): LibraryPage<LibraryTrack> => ({
  items,
  page: 1,
  pageSize: 100,
  total: items.length,
  hasMore: false,
});

const installEcho = (tracks: LibraryTrack[] = []) => {
  const playLocalFile = vi.fn().mockResolvedValue({
    state: 'playing',
    currentTrackId: tracks[0]?.id ?? null,
    positionMs: 0,
    durationMs: 180000,
    filePath: tracks[0]?.path ?? null,
  });

  window.echo = {
    library: {
      getTracks: vi.fn().mockResolvedValue(makePage(tracks)),
      getAlbums: vi.fn(),
      getAlbumTracks: vi.fn(),
      getSummary: vi.fn(),
      chooseFolder: vi.fn(),
      addFolder: vi.fn(),
      getFolders: vi.fn(),
      removeFolder: vi.fn(),
      scanFolder: vi.fn(),
      getScanStatus: vi.fn(),
      cancelScan: vi.fn(),
      getDiagnostics: vi.fn(),
    },
    playback: {
      getStatus: vi.fn().mockResolvedValue({
        state: 'idle',
        currentTrackId: null,
        positionMs: 0,
        durationMs: 0,
        filePath: null,
      }),
      playLocalFile,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      openLocalAudioFile: vi.fn(),
    },
    app: {
      getVersion: vi.fn(),
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
    },
    audio: {
      getStatus: vi.fn(),
      listDevices: vi.fn(),
      setOutput: vi.fn(),
    },
  } as unknown as Window['echo'];

  return { playLocalFile };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SongsPage', () => {
  it('dispatches navigation from the import folder button', async () => {
    installEcho();
    const navigate = vi.fn();
    window.addEventListener('app:navigate:import-folder', navigate);

    await renderSongsPage();
    fireEvent.click(screen.getByRole('button', { name: '导入文件夹' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    window.removeEventListener('app:navigate:import-folder', navigate);
  });

  it('plays a local file from TrackRow', async () => {
    const track = makeTrack();
    const { playLocalFile } = installEcho([track]);

    await renderSongsPage();

    await screen.findByText('Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Song One' }));

    await waitFor(() =>
      expect(playLocalFile).toHaveBeenCalledWith({
        filePath: track.path,
        trackId: track.id,
        probe: {
          durationSeconds: track.duration,
          fileSampleRate: track.sampleRate,
          channels: 2,
          codec: track.codec,
          bitDepth: track.bitDepth,
          bitrate: track.bitrate,
        },
      }),
    );
  });
});
