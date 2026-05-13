import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFile } from 'music-metadata';
import { LocalLyricsProvider } from './LocalLyricsProvider';
import { buildNormalizedLyricsQuery } from './lyricsQueryBuilder';
import type { LyricsQuery } from '../../shared/types/lyrics';

vi.mock('music-metadata', () => ({
  parseFile: vi.fn(),
}));

const parseFileMock = vi.mocked(parseFile);
const tempRoots: string[] = [];

const makeTempRoot = (): string => {
  const root = join(tmpdir(), `echo-next-local-lyrics-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  tempRoots.push(root);
  return root;
};

afterEach(() => {
  vi.clearAllMocks();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

const query = (filePath: string): LyricsQuery => ({
  trackId: 'track-1',
  title: 'Echo Song',
  artist: 'Echo Artist',
  album: 'Echo Album',
  durationSeconds: 120,
  filePath,
});

const request = (lyricsQuery: LyricsQuery) => ({
  query: lyricsQuery,
  normalized: buildNormalizedLyricsQuery(lyricsQuery),
  timeoutMs: 4500,
});

describe('LocalLyricsProvider', () => {
  it('prefers embedded synced lyrics over sidecar lyrics', async () => {
    const root = makeTempRoot();
    const filePath = join(root, 'Echo Song.flac');
    writeFileSync(filePath, 'audio');
    writeFileSync(join(root, 'Echo Song.lrc'), '[00:01.00]Sidecar');
    parseFileMock.mockResolvedValue({
      common: {
        lyrics: [
          {
            contentType: 1,
            timeStampFormat: 2,
            syncText: [{ timestamp: 1000, text: 'Embedded' }],
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof parseFile>>);

    const [candidate] = await new LocalLyricsProvider().search(request(query(filePath)));

    expect(candidate.sourceLabel).toBe('Embedded tag');
    expect(candidate.matchReasons).toContain('embedded_tag_priority');
    expect(candidate.syncedLyrics).toBe('[00:01.00]Embedded');
  });

  it('uses embedded plain lyrics', async () => {
    const root = makeTempRoot();
    const filePath = join(root, 'Echo Song.flac');
    writeFileSync(filePath, 'audio');
    parseFileMock.mockResolvedValue({
      common: {
        lyrics: [
          {
            contentType: 1,
            timeStampFormat: 2,
            text: 'Plain embedded line',
            syncText: [],
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof parseFile>>);

    const [candidate] = await new LocalLyricsProvider().search(request(query(filePath)));

    expect(candidate.sourceLabel).toBe('Embedded tag');
    expect(candidate.plainLyrics).toBe('Plain embedded line');
  });

  it('detects embedded LRC text as synced lyrics', async () => {
    const root = makeTempRoot();
    const filePath = join(root, 'Echo Song.flac');
    writeFileSync(filePath, 'audio');
    parseFileMock.mockResolvedValue({
      common: {
        lyrics: [
          {
            contentType: 1,
            timeStampFormat: 2,
            text: '[00:01.00]Embedded LRC',
            syncText: [],
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof parseFile>>);

    const [candidate] = await new LocalLyricsProvider().search(request(query(filePath)));

    expect(candidate.syncedLyrics).toBe('[00:01.00]Embedded LRC');
    expect(candidate.plainLyrics).toBeNull();
  });

  it('falls back to sidecar lyrics when embedded lyrics are empty', async () => {
    const root = makeTempRoot();
    const filePath = join(root, 'Echo Song.flac');
    writeFileSync(filePath, 'audio');
    writeFileSync(join(root, 'Echo Song.lrc'), '[00:01.00]Sidecar');
    parseFileMock.mockResolvedValue({
      common: {
        lyrics: [
          {
            contentType: 1,
            timeStampFormat: 2,
            text: '   ',
            syncText: [],
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof parseFile>>);

    const [candidate] = await new LocalLyricsProvider().search(request(query(filePath)));

    expect(candidate.sourceLabel).toBe('Local LRC');
    expect(candidate.syncedLyrics).toBe('[00:01.00]Sidecar');
  });
});
