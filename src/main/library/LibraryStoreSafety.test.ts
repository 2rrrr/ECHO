import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type EchoDatabase } from '../database/createDatabase';
import { AlbumService } from './AlbumService';
import { LibraryStore } from './LibraryStore';
import type { TrackWrite } from './libraryTypes';

let database: EchoDatabase | null = null;

const makeStore = (): LibraryStore => {
  database = createDatabase(':memory:');
  return new LibraryStore(database);
};

const baseTrack = (folderId: string, path: string, overrides: Partial<TrackWrite> = {}): TrackWrite => ({
  id: 'track-1',
  path,
  folderId,
  sizeBytes: 1024,
  mtimeMs: 1,
  title: 'Safe Title',
  artist: 'Safe Artist',
  album: 'Safe Album',
  albumArtist: 'Safe Artist',
  trackNo: null,
  discNo: null,
  year: null,
  genre: null,
  duration: 120,
  codec: 'FLAC',
  sampleRate: 44100,
  bitDepth: 16,
  bitrate: 900000,
  bpm: null,
  replayGainTrackGainDb: null,
  replayGainAlbumGainDb: null,
  replayGainTrackPeak: null,
  replayGainAlbumPeak: null,
  replayGainIntegratedLufs: null,
  coverId: null,
  fieldSources: {
    title: 'embedded',
    artist: 'embedded',
    album: 'embedded',
    albumArtist: 'embedded',
    genre: 'embedded',
    codec: 'technical',
  },
  embeddedMetadataStatus: 'present',
  embeddedCoverStatus: 'missing',
  metadataStatus: 'ok',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  database?.close();
  database = null;
});

describe('LibraryStore track metadata safety', () => {
  it('sanitizes unsafe track text before writing and when reading stale rows', () => {
    const store = makeStore();
    const folder = store.addFolder('D:\\Music');
    const path = 'D:\\Music\\Bad Artist - Bad Title.flac';
    const badText = `\u0000APIC image/jpeg Front cover JFIF ${'x'.repeat(4096)}`;

    store.upsertTrack(baseTrack(folder.id, path, {
      title: badText,
      artist: badText,
      album: badText,
      albumArtist: badText,
      genre: badText,
      codec: badText,
    }));

    const written = store.getTrack('track-1');
    expect(written).toMatchObject({
      title: 'Bad Title',
      artist: 'Bad Artist',
      album: '',
      albumArtist: 'Bad Artist',
      genre: null,
      codec: null,
    });
    expect(store.getTracks({ search: 'APIC', pageSize: 10 }).total).toBe(0);
    expect(store.getTracks({ search: 'Bad Title', pageSize: 10 }).total).toBe(1);

    database!.prepare(
      `UPDATE tracks
       SET title = ?, artist = ?, album = ?, album_artist = ?, genre = ?, codec = ?
       WHERE id = ?`,
    ).run(badText, badText, badText, badText, badText, badText, 'track-1');

    const readBack = store.getTrack('track-1');
    expect(readBack).toMatchObject({
      title: 'Bad Title',
      artist: 'Bad Artist',
      album: '',
      albumArtist: 'Bad Artist',
      genre: null,
      codec: null,
    });
  });

  it('backfills Japanese romaji search terms for existing tracks', async () => {
    const store = makeStore();
    const folder = store.addFolder('D:\\Music');
    const path = 'D:\\Music\\Japanese.flac';

    store.upsertTrack(baseTrack(folder.id, path, {
      title: '君が好き',
      artist: 'Echo Artist',
    }));

    expect(store.getTracks({ search: 'kimi', pageSize: 10 }).total).toBe(0);
    expect(await store.rebuildJapaneseRomanizedSearchTerms()).toBe(1);

    const page = store.getTracks({ search: 'kimi', pageSize: 10 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.title).toBe('君が好き');
  });

  it('sanitizes stale album and artist rows before returning them to the renderer', () => {
    const store = makeStore();
    const folder = store.addFolder('D:\\Music');
    const path = 'D:\\Music\\Safe Artist - Safe Title.flac';
    const badText = `APIC image/jpeg Front cover JFIF ${'x'.repeat(4096)}`;

    store.upsertTrack(baseTrack(folder.id, path));
    store.refreshAlbums(new AlbumService(), '2026-01-01T00:00:00.000Z');
    store.refreshArtists();
    database!.prepare('UPDATE albums SET title = ?, album_artist = ?').run(badText, badText);
    database!.prepare('UPDATE artists SET name = ?, sort_name = ?').run(badText, badText);

    expect(store.getAlbums({ pageSize: 1 }).items[0]).toMatchObject({
      title: '',
      albumArtist: 'Unknown Artist',
    });
    expect(store.getArtists({ pageSize: 1 }).items[0]).toMatchObject({
      name: 'Unknown Artist',
      sortName: 'Unknown Artist',
    });
  });

  it('counts only available tracks when paging album detail tracks', () => {
    const store = makeStore();
    const folder = store.addFolder('D:\\Music');

    store.upsertTrack(baseTrack(folder.id, 'D:\\Music\\one.flac', { id: 'track-1', title: 'One', trackNo: 1 }));
    store.upsertTrack(baseTrack(folder.id, 'D:\\Music\\two.flac', { id: 'track-2', title: 'Two', trackNo: 2 }));
    store.refreshAlbums(new AlbumService(), '2026-01-01T00:00:00.000Z');

    const album = store.getAlbums({ pageSize: 1 }).items[0];
    database!.prepare('UPDATE tracks SET missing = 1 WHERE id = ?').run('track-2');

    const tracks = store.getAlbumTracks(album.id, { page: 1, pageSize: 10 });

    expect(tracks.total).toBe(1);
    expect(tracks.hasMore).toBe(false);
    expect(tracks.items.map((track) => track.id)).toEqual(['track-1']);
  });
});
