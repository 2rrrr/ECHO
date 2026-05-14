import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type EchoDatabase } from '../database/createDatabase';
import { LibraryStore } from '../library/LibraryStore';
import { StreamingCacheStore } from './StreamingCacheStore';
import type { StreamingPlaylistDetail, StreamingTrack } from '../../shared/types/streaming';

const track = (overrides: Partial<StreamingTrack> = {}): StreamingTrack => ({
  id: 'streaming:netease:track-1',
  provider: 'netease',
  providerTrackId: 'track-1',
  stableKey: 'streaming:netease:track-1',
  title: 'Imported Song',
  artist: 'Imported Artist',
  artists: [],
  album: 'Imported Album',
  albumId: 'album-1',
  albumArtist: 'Imported Artist',
  duration: 180,
  coverUrl: 'echo-image://remote/album-large',
  coverThumb: 'echo-image://remote/album-thumb',
  qualities: ['standard', 'high'],
  explicit: false,
  playable: true,
  unavailableReason: null,
  lyricsStatus: 'available',
  mvStatus: 'unknown',
  ...overrides,
});

const playlist = (tracks: StreamingTrack[]): StreamingPlaylistDetail => ({
  id: 'streaming:netease:playlist:playlist-1',
  provider: 'netease',
  providerPlaylistId: 'playlist-1',
  title: 'Imported Playlist',
  description: 'Streaming playlist description',
  creator: 'Tester',
  coverUrl: 'echo-image://remote/playlist-large',
  coverThumb: 'echo-image://remote/playlist-thumb',
  trackCount: tracks.length,
  tracks,
  page: 1,
  pageSize: 500,
  total: tracks.length,
  hasMore: false,
});

describe('StreamingCacheStore', () => {
  let database: EchoDatabase | null = null;

  afterEach(() => {
    database?.close();
    database = null;
  });

  it('keeps imported playlist and track remote covers visible through the library store', () => {
    database = createDatabase(':memory:');
    const cache = new StreamingCacheStore(database);
    const library = new LibraryStore(database);

    const imported = cache.importStreamingPlaylistPage(playlist([track({ playable: false })]), {
      reset: true,
      startPosition: 0,
    });

    expect(imported.playlist.coverThumb).toBe('echo-image://remote/playlist-thumb');
    expect(library.getPlaylist(imported.playlist.id)?.coverThumb).toBe('echo-image://remote/playlist-thumb');

    database.prepare('UPDATE playlists SET cover_url = NULL WHERE id = ?').run(imported.playlist.id);
    expect(library.getPlaylist(imported.playlist.id)?.coverThumb).toBe('echo-image://remote/album-large');

    const [item] = library.getPlaylistItems(imported.playlist.id, { pageSize: 10 }).items;
    expect(item).toMatchObject({
      mediaType: 'stream_track',
      coverThumb: 'echo-image://remote/album-large',
      unavailable: false,
    });
  });
});
