// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryPage, LibraryPlaylist, LibraryPlaylistItem, LibraryTrack } from '../../shared/types/library';
import { PlaybackQueueProvider } from '../stores/PlaybackQueueProvider';
import { PlaylistsPage } from './PlaylistsPage';

vi.mock('../components/library/TrackList', () => ({
  TrackList: ({ tracks }: { tracks: LibraryTrack[] }) => (
    <div data-testid="playlist-track-list">
      {tracks.map((track) => (
        <span key={track.playlistItemId ?? track.id}>{track.title}</span>
      ))}
    </div>
  ),
}));

vi.mock('../components/library/TrackContextMenu', () => ({
  TrackContextMenu: () => null,
}));

const playlist = (overrides: Partial<LibraryPlaylist> = {}): LibraryPlaylist => ({
  id: 'playlist-1',
  name: 'Road Mix',
  description: 'Manual local playlist',
  kind: 'manual',
  sourceProvider: 'local',
  sourcePlaylistId: null,
  coverId: null,
  coverThumb: null,
  sortMode: 'manual',
  itemCount: 1,
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-05-14T00:00:00.000Z',
  ...overrides,
});

const track = (overrides: Partial<LibraryTrack> = {}): LibraryTrack => ({
  id: 'track-1',
  path: 'D:\\Music\\Song.flac',
  title: 'Song One',
  artist: 'Artist',
  album: 'Album',
  albumArtist: 'Artist',
  trackNo: null,
  discNo: null,
  year: null,
  genre: null,
  duration: 180,
  codec: 'FLAC',
  sampleRate: 44100,
  bitDepth: 16,
  bitrate: 900000,
  coverId: null,
  coverThumb: null,
  fieldSources: {},
  ...overrides,
});

const item = (overrides: Partial<LibraryPlaylistItem> = {}): LibraryPlaylistItem => ({
  id: 'item-1',
  playlistId: 'playlist-1',
  mediaType: 'track',
  mediaId: 'track-1',
  sourceProvider: 'local',
  sourceItemId: null,
  titleSnapshot: 'Song One',
  artistSnapshot: 'Artist',
  albumSnapshot: 'Album',
  durationSnapshot: 180,
  coverId: null,
  coverThumb: null,
  position: 0,
  addedAt: '2026-05-14T00:00:00.000Z',
  addedFrom: 'manual',
  unavailable: false,
  track: track(),
  ...overrides,
});

const page = (items: LibraryPlaylistItem[]): LibraryPage<LibraryPlaylistItem> => ({
  items,
  page: 1,
  pageSize: 100,
  total: items.length,
  hasMore: false,
});

const renderPlaylistsPage = () =>
  render(
    <PlaybackQueueProvider>
      <PlaylistsPage />
    </PlaybackQueueProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PlaylistsPage actions menu', () => {
  it('renames the selected playlist from the menu', async () => {
    const renamed = playlist({ name: 'Road Mix 2' });
    window.prompt = vi.fn(() => 'Road Mix 2');
    window.echo = {
      library: {
        getPlaylists: vi.fn().mockResolvedValueOnce([playlist()]).mockResolvedValue([renamed]),
        getPlaylistItems: vi.fn().mockResolvedValue(page([item()])),
        updatePlaylist: vi.fn().mockResolvedValue(renamed),
        getLikedTrackIds: vi.fn().mockResolvedValue({}),
      },
      playback: {
        getStatus: vi.fn().mockResolvedValue({ state: 'idle', currentTrackId: null, positionMs: 0, durationMs: 0, filePath: null }),
      },
    } as unknown as Window['echo'];

    renderPlaylistsPage();

    fireEvent.click(await screen.findByRole('button', { name: '更多歌单操作' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名歌单' }));

    await waitFor(() =>
      expect(window.echo.library.updatePlaylist).toHaveBeenCalledWith({ playlistId: 'playlist-1', name: 'Road Mix 2' }),
    );
    expect(await screen.findByText('歌单已重命名')).toBeTruthy();
  });

  it('updates sort mode and exports the playlist from the menu', async () => {
    const sorted = playlist({ sortMode: 'titleAsc' });
    window.echo = {
      library: {
        getPlaylists: vi.fn().mockResolvedValueOnce([playlist()]).mockResolvedValue([sorted]),
        getPlaylistItems: vi.fn().mockResolvedValue(page([item()])),
        updatePlaylist: vi.fn().mockResolvedValue(sorted),
        exportPlaylist: vi.fn().mockResolvedValue('D:\\Exports\\Road Mix.json'),
        getLikedTrackIds: vi.fn().mockResolvedValue({}),
      },
      playback: {
        getStatus: vi.fn().mockResolvedValue({ state: 'idle', currentTrackId: null, positionMs: 0, durationMs: 0, filePath: null }),
      },
    } as unknown as Window['echo'];

    renderPlaylistsPage();

    fireEvent.click(await screen.findByRole('button', { name: '更多歌单操作' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '歌名 A-Z' }));
    await waitFor(() =>
      expect(window.echo.library.updatePlaylist).toHaveBeenCalledWith({ playlistId: 'playlist-1', sortMode: 'titleAsc' }),
    );
    expect(await screen.findByText('排序方式已更新')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '更多歌单操作' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'JSON' }));

    await waitFor(() =>
      expect(window.echo.library.exportPlaylist).toHaveBeenCalledWith({ playlistId: 'playlist-1', format: 'json' }),
    );
    expect(await screen.findByText('歌单已导出：D:\\Exports\\Road Mix.json')).toBeTruthy();
  });
});
