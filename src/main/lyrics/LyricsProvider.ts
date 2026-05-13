import { randomUUID } from 'node:crypto';
import type { LyricLine, LyricsProviderId, LyricsQuery, TrackLyrics } from '../../shared/types/lyrics';
import { detectLyricsKind, parsePlainLyrics, parseSyncedLyrics } from './lyricsParser';
import type { NormalizedLyricsQuery } from './lyricsQueryBuilder';

export type { LyricsProviderId };

export type LyricsProviderCapability = {
  synced: boolean;
  plain: boolean;
  translation: boolean;
  romanization: boolean;
  byDuration: boolean;
  byIsrc: boolean;
  byMusicBrainzId: boolean;
  needsAccount: boolean;
};

export type LyricsProviderSearchRequest = {
  query: LyricsQuery;
  normalized: NormalizedLyricsQuery;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type LyricsProviderResult = {
  provider: LyricsProviderId;
  providerLyricsId: string | null;
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  translationLyrics?: string | null;
  romanizationLyrics?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string;
  matchReasons?: string[];
  raw?: unknown;
};

export interface LyricsProvider {
  id: LyricsProviderId;
  label: string;
  priority: number;
  capabilities: LyricsProviderCapability;

  search(request: LyricsProviderSearchRequest): Promise<LyricsProviderResult[]>;
  getById?(id: string, request: LyricsProviderSearchRequest): Promise<LyricsProviderResult | null>;
}

const normalizeSecondaryText = (value: string): string | null => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
};

const mergeRomanizationLines = (lines: LyricLine[], romanizationLyrics?: string | null): LyricLine[] => {
  if (!romanizationLyrics || lines.length === 0) {
    return lines;
  }

  const syncedRomanization = parseSyncedLyrics(romanizationLyrics);
  if (syncedRomanization.length > 0) {
    const byTime = new Map<number, string>();
    for (const line of syncedRomanization) {
      const romanization = normalizeSecondaryText(line.text);
      if (romanization) {
        byTime.set(line.timeMs, romanization);
      }
    }

    return lines.map((line) => {
      const romanization = byTime.get(line.timeMs);
      return romanization ? { ...line, romanization } : line;
    });
  }

  const plainRomanization = parsePlainLyrics(romanizationLyrics);
  if (plainRomanization.length === 0) {
    return lines;
  }

  return lines.map((line, index) => {
    const romanization = normalizeSecondaryText(plainRomanization[index]?.text ?? '');
    return romanization ? { ...line, romanization } : line;
  });
};

export const providerResultToTrackLyrics = (
  query: LyricsQuery,
  result: LyricsProviderResult,
  score: number | null,
): TrackLyrics | null => {
  const kind = detectLyricsKind({
    syncedLyrics: result.syncedLyrics,
    plainLyrics: result.plainLyrics,
    instrumental: result.instrumental,
  });
  const lines =
    kind === 'synced'
      ? parseSyncedLyrics(result.syncedLyrics ?? '')
      : kind === 'plain'
        ? parsePlainLyrics(result.plainLyrics ?? '')
        : [];
  const linesWithRomanization = mergeRomanizationLines(lines, result.romanizationLyrics);

  if (kind === 'empty') {
    return null;
  }

  const timestamp = new Date().toISOString();
  return {
    id: randomUUID(),
    trackId: query.trackId ?? null,
    provider: result.provider,
    providerLyricsId: result.providerLyricsId,
    kind,
    title: result.title,
    artist: result.artist,
    album: result.album,
    durationSeconds: result.durationSeconds,
    lines: linesWithRomanization,
    plainText: result.plainLyrics,
    syncedText: result.syncedLyrics,
    offsetMs: 0,
    score,
    cachedAt: timestamp,
    updatedAt: timestamp,
  };
};

const emptyCapability: LyricsProviderCapability = {
  synced: false,
  plain: false,
  translation: false,
  romanization: false,
  byDuration: false,
  byIsrc: false,
  byMusicBrainzId: false,
  needsAccount: false,
};

export class StubLyricsProvider implements LyricsProvider {
  capabilities: LyricsProviderCapability = { ...emptyCapability };

  constructor(
    readonly id: Exclude<LyricsProviderId, 'local' | 'lrclib' | 'manual'>,
    readonly label: string,
    readonly priority: number,
  ) {}

  async search(): Promise<LyricsProviderResult[]> {
    // Reserved for future provider integrations. Do not perform network work here.
    return [];
  }
}
