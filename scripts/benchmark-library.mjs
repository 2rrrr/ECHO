import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const schemaSql = `
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE covers (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_hash TEXT,
  mime_type TEXT,
  thumb_path TEXT,
  large_path TEXT,
  original_ref TEXT,
  cover_thumb TEXT,
  cover_large TEXT,
  cover_original TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  folder_id TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  album_artist TEXT NOT NULL,
  track_no INTEGER,
  disc_no INTEGER,
  year INTEGER,
  genre TEXT,
  duration REAL NOT NULL DEFAULT 0,
  codec TEXT,
  sample_rate INTEGER,
  bit_depth INTEGER,
  bitrate INTEGER,
  cover_id TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'ok',
  field_sources_json TEXT NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  album_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  album_artist TEXT NOT NULL,
  year INTEGER,
  cover_id TEXT,
  track_count INTEGER NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE album_tracks (
  album_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  disc_no INTEGER,
  track_no INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, track_id)
);

CREATE INDEX idx_tracks_path ON tracks(path);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_albums_album_key ON albums(album_key);
CREATE INDEX idx_album_tracks_album_id ON album_tracks(album_id);
`;

const nowIso = () => new Date().toISOString();

export const createFakeTrack = (index, folderId = 'folder-1') => {
  const albumIndex = Math.floor(index / 10);
  const artistIndex = albumIndex % 250;

  return {
    id: `track-${index}`,
    path: resolve(`D:/FakeLibrary/Album ${albumIndex}/Track ${index}.flac`),
    folderId,
    sizeBytes: 4_000_000 + index,
    mtimeMs: 1_700_000_000_000 + index,
    title: `Track ${index}`,
    artist: `Artist ${artistIndex}`,
    album: `Album ${albumIndex}`,
    albumArtist: `Album Artist ${artistIndex}`,
    trackNo: (index % 10) + 1,
    discNo: 1,
    year: 2020 + (albumIndex % 7),
    genre: 'Benchmark',
    duration: 180 + (index % 90),
    codec: index % 3 === 0 ? 'FLAC' : 'MP3',
    sampleRate: index % 4 === 0 ? 96000 : 44100,
    bitDepth: index % 3 === 0 ? 24 : 16,
    bitrate: 900000,
    coverId: null,
    metadataStatus: 'ok',
    fieldSources: JSON.stringify({ title: 'embedded', artist: 'embedded', album: 'embedded' }),
  };
};

export const generateFakeTracks = (count) => Array.from({ length: count }, (_, index) => createFakeTrack(index + 1));

const insertTracks = (database, tracks) => {
  const insertFolder = database.prepare(
    `INSERT INTO folders (id, path, name, status, enabled, last_scan_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertTrack = database.prepare(
    `INSERT INTO tracks (
      id, path, folder_id, size_bytes, mtime_ms, title, artist, album, album_artist,
      track_no, disc_no, year, genre, duration, codec, sample_rate, bit_depth, bitrate,
      cover_id, metadata_status, field_sources_json, missing, created_at, updated_at
    ) VALUES (
      @id, @path, @folderId, @sizeBytes, @mtimeMs, @title, @artist, @album, @albumArtist,
      @trackNo, @discNo, @year, @genre, @duration, @codec, @sampleRate, @bitDepth, @bitrate,
      @coverId, @metadataStatus, @fieldSources, 0, @createdAt, @updatedAt
    )`,
  );
  const timestamp = nowIso();

  database.transaction(() => {
    insertFolder.run('folder-1', resolve('D:/FakeLibrary'), 'FakeLibrary', 'active', 1, null, timestamp, timestamp);

    for (const track of tracks) {
      insertTrack.run({
        ...track,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  })();
};

const refreshAlbums = (database) => {
  const tracks = database
    .prepare(
      `SELECT id, artist, album, album_artist, year, duration, cover_id, disc_no, track_no
       FROM tracks
       WHERE missing = 0
       ORDER BY album_artist COLLATE NOCASE, album COLLATE NOCASE, disc_no, track_no, title COLLATE NOCASE`,
    )
    .all();
  const albums = new Map();
  const links = [];

  tracks.forEach((track, index) => {
    const albumKey = `${String(track.album_artist).toLowerCase()}::${String(track.album).toLowerCase()}::${track.year ?? ''}`;
    const album =
      albums.get(albumKey) ??
      {
        id: `album-${albums.size + 1}`,
        albumKey,
        title: track.album,
        albumArtist: track.album_artist,
        year: track.year,
        coverId: track.cover_id,
        trackCount: 0,
        duration: 0,
      };

    album.trackCount += 1;
    album.duration += Number(track.duration ?? 0);
    albums.set(albumKey, album);
    links.push({
      albumId: album.id,
      trackId: track.id,
      discNo: track.disc_no,
      trackNo: track.track_no,
      position: index,
    });
  });

  const timestamp = nowIso();
  const insertAlbum = database.prepare(
    `INSERT INTO albums (id, album_key, title, album_artist, year, cover_id, track_count, duration, created_at, updated_at)
     VALUES (@id, @albumKey, @title, @albumArtist, @year, @coverId, @trackCount, @duration, @createdAt, @updatedAt)`,
  );
  const insertLink = database.prepare(
    'INSERT INTO album_tracks (album_id, track_id, disc_no, track_no, position) VALUES (@albumId, @trackId, @discNo, @trackNo, @position)',
  );

  database.transaction(() => {
    database.prepare('DELETE FROM album_tracks').run();
    database.prepare('DELETE FROM albums').run();

    for (const album of albums.values()) {
      insertAlbum.run({
        ...album,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const link of links) {
      insertLink.run(link);
    }
  })();

  return albums.size;
};

const measure = (work) => {
  const startedAt = performance.now();
  const result = work();
  return {
    result,
    durationMs: performance.now() - startedAt,
  };
};

export const runBenchmark = (trackCount, options = {}) => {
  const root = options.root ?? join(tmpdir(), `echo-next-library-bench-${trackCount}-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  const databasePath = join(root, 'library.sqlite');
  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.exec(schemaSql);

  try {
    const tracks = generateFakeTracks(trackCount);
    const insert = measure(() => insertTracks(database, tracks));
    const grouping = measure(() => refreshAlbums(database));
    const getTracksPage1 = measure(() =>
      database
        .prepare(
          `SELECT id, path, title, artist, album, album_artist, duration, codec, sample_rate, bit_depth, bitrate
           FROM tracks
           WHERE missing = 0
           ORDER BY title COLLATE NOCASE, artist COLLATE NOCASE
           LIMIT 100 OFFSET 0`,
        )
        .all(),
    );
    const getAlbumsPage1 = measure(() =>
      database
        .prepare(
          `SELECT id, album_key, title, album_artist, track_count, duration
           FROM albums
           ORDER BY title COLLATE NOCASE, album_artist COLLATE NOCASE
           LIMIT 60 OFFSET 0`,
        )
        .all(),
    );
    const unchangedScanSkip = measure(() => {
      const fingerprints = new Map(tracks.map((track) => [track.path, `${track.sizeBytes}:${track.mtimeMs}`]));
      const rows = database.prepare('SELECT path, size_bytes, mtime_ms FROM tracks WHERE missing = 0').all();
      return rows.filter((row) => fingerprints.get(row.path) === `${row.size_bytes}:${row.mtime_ms}`).length;
    });
    const memory = process.memoryUsage();

    return {
      tracks: trackCount,
      albumsCount: grouping.result,
      insertDurationMs: insert.durationMs,
      groupingDurationMs: grouping.durationMs,
      getTracksPage1DurationMs: getTracksPage1.durationMs,
      getAlbumsPage1DurationMs: getAlbumsPage1.durationMs,
      unchangedScanSkipDurationMs: unchangedScanSkip.durationMs,
      unchangedScanSkipped: unchangedScanSkip.result,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
      },
      databaseSizeBytes: statSync(databasePath).size,
      databasePath,
    };
  } finally {
    database.close();

    if (options.cleanup !== false) {
      rmSync(root, { recursive: true, force: true });
    }
  }
};

const printResult = (result) => {
  console.log(`tracks: ${result.tracks}`);
  console.log(`albums count: ${result.albumsCount}`);
  console.log(`insert duration: ${result.insertDurationMs.toFixed(2)} ms`);
  console.log(`grouping duration: ${result.groupingDurationMs.toFixed(2)} ms`);
  console.log(`getTracks page1 duration: ${result.getTracksPage1DurationMs.toFixed(2)} ms`);
  console.log(`getAlbums page1 duration: ${result.getAlbumsPage1DurationMs.toFixed(2)} ms`);
  console.log(`unchanged scan skip: ${result.unchangedScanSkipped} in ${result.unchangedScanSkipDurationMs.toFixed(2)} ms`);
  console.log(`memory rss / heapUsed: ${result.memory.rss} / ${result.memory.heapUsed}`);
  console.log(`database size: ${result.databaseSizeBytes}`);
  console.log('');
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const count of [3000, 10000]) {
    printResult(runBenchmark(count));
  }
}
