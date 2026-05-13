import { randomUUID } from 'node:crypto';
import type { LyricsQuery, LyricsSearchCandidate, TrackLyrics } from '../../shared/types/lyrics';
import type { LyricsProvider, LyricsProviderCapability, LyricsProviderResult, LyricsProviderSearchRequest } from './LyricsProvider';
import { detectLyricsKind, parsePlainLyrics, parseSyncedLyrics } from './lyricsParser';
import { scoreLyricsCandidate } from './lyricsScoring';

export type LrclibRecord = {
  id?: number | string | null;
  trackName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean | null;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const apiRoot = 'https://lrclib.net/api';
const defaultTimeoutMs = 8000;
const userAgent = 'ECHO-Next/1.0.1 (https://github.com/Moekotori/ECHO-Next; contact email)';

const textOrEmpty = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const textOrNull = (value: unknown): string | null => {
  const text = textOrEmpty(value);
  return text.length ? text : null;
};

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const mapRecord = (value: unknown): LrclibRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: typeof value.id === 'string' || typeof value.id === 'number' ? value.id : null,
    trackName: textOrNull(value.trackName),
    artistName: textOrNull(value.artistName),
    albumName: textOrNull(value.albumName),
    duration: numberOrNull(value.duration),
    instrumental: value.instrumental === true,
    plainLyrics: textOrNull(value.plainLyrics),
    syncedLyrics: textOrNull(value.syncedLyrics),
  };
};

const buildUrl = (pathName: string, query: LyricsQuery, includeDuration: boolean): string => {
  const url = new URL(`${apiRoot}${pathName}`);
  url.searchParams.set('track_name', query.title);
  url.searchParams.set('artist_name', query.artist);
  if (query.album) {
    url.searchParams.set('album_name', query.album);
  }

  if (includeDuration && query.durationSeconds) {
    url.searchParams.set('duration', String(Math.round(query.durationSeconds)));
  }

  return url.toString();
};

const fetchJson = async (url: string, timeoutMs = defaultTimeoutMs, signal?: AbortSignal): Promise<unknown | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    signal?.removeEventListener('abort', abort);
    clearTimeout(timer);
  }
};

export const mapLrclibRecordToTrackLyrics = (
  query: LyricsQuery,
  record: LrclibRecord,
  score: number | null,
): TrackLyrics | null => {
  const kind = detectLyricsKind({
    syncedLyrics: record.syncedLyrics,
    plainLyrics: record.plainLyrics,
    instrumental: record.instrumental,
  });
  const lines =
    kind === 'synced'
      ? parseSyncedLyrics(record.syncedLyrics ?? '')
      : kind === 'plain'
        ? parsePlainLyrics(record.plainLyrics ?? '')
        : [];

  if (kind === 'empty') {
    return null;
  }

  const timestamp = new Date().toISOString();
  return {
    id: randomUUID(),
    trackId: query.trackId ?? null,
    provider: 'lrclib',
    providerLyricsId: record.id == null ? null : String(record.id),
    kind,
    title: record.trackName ?? query.title,
    artist: record.artistName ?? query.artist,
    album: record.albumName ?? query.album ?? null,
    durationSeconds: record.duration ?? query.durationSeconds ?? null,
    lines,
    plainText: record.plainLyrics ?? null,
    syncedText: record.syncedLyrics ?? null,
    offsetMs: 0,
    score,
    cachedAt: timestamp,
    updatedAt: timestamp,
  };
};

const recordToResult = (record: LrclibRecord): LyricsProviderResult => ({
  provider: 'lrclib',
  providerLyricsId: record.id == null ? null : String(record.id),
  title: record.trackName ?? '',
  artist: record.artistName ?? '',
  album: record.albumName ?? null,
  durationSeconds: record.duration ?? null,
  instrumental: record.instrumental === true,
  plainLyrics: record.plainLyrics ?? null,
  syncedLyrics: record.syncedLyrics ?? null,
  sourceUrl: record.id == null ? null : `https://lrclib.net/api/get/${String(record.id)}`,
  raw: record,
});

export class LrclibProvider implements LyricsProvider {
  readonly id = 'lrclib' as const;
  readonly label = 'LRCLIB';
  readonly priority = 700;
  readonly capabilities: LyricsProviderCapability = {
    synced: true,
    plain: true,
    translation: false,
    romanization: false,
    byDuration: true,
    byIsrc: false,
    byMusicBrainzId: false,
    needsAccount: false,
  };

  async search(request: LyricsProviderSearchRequest): Promise<LyricsProviderResult[]> {
    const results: LyricsProviderResult[] = [];
    const seen = new Set<string>();

    for (const variant of request.normalized.searchVariants) {
      if (request.signal?.aborted) {
        break;
      }

      const variantQuery: LyricsQuery = {
        ...request.query,
        title: variant.title,
        artist: variant.artist,
        album: variant.album,
        filePath: null,
      };
      const json = await fetchJson(buildUrl('/search', variantQuery, false), request.timeoutMs, request.signal);
      if (!Array.isArray(json)) {
        continue;
      }

      for (const record of json.map(mapRecord).filter((item): item is LrclibRecord => Boolean(item))) {
        const result = recordToResult(record);
        if (!result.title) {
          result.title = request.query.title;
        }

        if (!result.artist) {
          result.artist = request.query.artist;
        }

        const key = result.providerLyricsId ?? `${result.title}|${result.artist}|${result.album}|${result.durationSeconds}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(result);
        }
      }
    }

    return results;
  }

  async getLyrics(query: LyricsQuery): Promise<TrackLyrics | null> {
    const json = await fetchJson(buildUrl('/get', query, true));
    const record = mapRecord(json);
    if (!record) {
      return null;
    }

    const candidate = this.recordToCandidate(query, record);
    return mapLrclibRecordToTrackLyrics(query, record, candidate.score);
  }

  async searchCandidates(query: LyricsQuery): Promise<Array<LyricsSearchCandidate & { raw: LrclibRecord }>> {
    const json = await fetchJson(buildUrl('/search', query, false));
    if (!Array.isArray(json)) {
      return [];
    }

    return json
      .map(mapRecord)
      .filter((record): record is LrclibRecord => Boolean(record))
      .map((record) => ({
        ...this.recordToCandidate(query, record),
        raw: record,
      }))
      .sort((left, right) => right.score - left.score);
  }

  private recordToCandidate(query: LyricsQuery, record: LrclibRecord): LyricsSearchCandidate {
    const candidateWithoutScore = {
      provider: 'lrclib' as const,
      providerLyricsId: record.id == null ? null : String(record.id),
      title: record.trackName ?? query.title,
      artist: record.artistName ?? query.artist,
      album: record.albumName ?? null,
      durationSeconds: record.duration ?? null,
      instrumental: record.instrumental === true,
      hasSynced: Boolean(record.syncedLyrics),
      hasPlain: Boolean(record.plainLyrics),
      sourceLabel: 'LRCLIB',
    };

    return {
      id: randomUUID(),
      ...candidateWithoutScore,
      score: scoreLyricsCandidate(query, candidateWithoutScore),
    };
  }
}
