import type { LyricsQuery } from '../../shared/types/lyrics';
import { asRecord, fetchJsonWithTimeout, number, text } from '../library/network/providers/providerFetch';
import type { LyricsProvider, LyricsProviderCapability, LyricsProviderResult, LyricsProviderSearchRequest } from './LyricsProvider';
import { parseSyncedLyrics } from './lyricsParser';

const neteaseHeaders = {
  Referer: 'https://music.163.com/',
};

const lyricText = (value: unknown): string | null => text(asRecord(value).lyric);

const splitLyricsByKind = (value: string | null): { syncedLyrics: string | null; plainLyrics: string | null } => {
  if (!value) {
    return { syncedLyrics: null, plainLyrics: null };
  }

  return parseSyncedLyrics(value).length > 0
    ? { syncedLyrics: value, plainLyrics: null }
    : { syncedLyrics: null, plainLyrics: value };
};

type NeteaseSong = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number | null;
  raw: unknown;
};

const searchQueryFor = (query: LyricsQuery): string => [query.title, query.artist].filter(Boolean).join(' ').trim();

export class NeteaseLyricsProvider implements LyricsProvider {
  readonly id = 'netease' as const;
  readonly label = 'NetEase';
  readonly priority = 600;
  readonly capabilities: LyricsProviderCapability = {
    synced: true,
    plain: true,
    translation: true,
    romanization: true,
    byDuration: true,
    byIsrc: false,
    byMusicBrainzId: false,
    needsAccount: false,
  };

  async search(request: LyricsProviderSearchRequest): Promise<LyricsProviderResult[]> {
    try {
      const songs = await this.searchSongs(request);
      const results = await Promise.all(songs.slice(0, 5).map((song) => this.fetchLyrics(song, request)));
      return results.filter((result): result is LyricsProviderResult => Boolean(result));
    } catch {
      return [];
    }
  }

  private async searchSongs(request: LyricsProviderSearchRequest): Promise<NeteaseSong[]> {
    const seen = new Set<string>();
    const songs: NeteaseSong[] = [];

    for (const variant of request.normalized.searchVariants) {
      if (request.signal?.aborted) {
        break;
      }

      const query = searchQueryFor({
        ...request.query,
        title: variant.title,
        artist: variant.artist,
        album: variant.album,
      });
      if (!query) {
        continue;
      }

      const params = new URLSearchParams({ type: '1', s: query, limit: '5', offset: '0' });
      const data = asRecord(
        await fetchJsonWithTimeout(`https://music.163.com/api/search/get/web?${params.toString()}`, request.signal, neteaseHeaders, request.timeoutMs),
      );
      const rawSongs = asRecord(data.result).songs;
      const songValues = Array.isArray(rawSongs) ? rawSongs : [];

      for (const songValue of songValues) {
        const song = asRecord(songValue);
        const id = String(song.id ?? '');
        if (!id || seen.has(id)) {
          continue;
        }

        const artists = Array.isArray(song.artists) ? song.artists.map(asRecord) : [];
        const artist = artists.map((artistValue) => text(artistValue.name)).filter(Boolean).join(' / ');
        const album = asRecord(song.album);
        const durationMs = number(song.duration);

        seen.add(id);
        songs.push({
          id,
          title: text(song.name) ?? request.query.title,
          artist: artist || request.query.artist,
          album: text(album.name),
          durationSeconds: durationMs ? durationMs / 1000 : null,
          raw: songValue,
        });
      }
    }

    return songs;
  }

  private async fetchLyrics(song: NeteaseSong, request: LyricsProviderSearchRequest): Promise<LyricsProviderResult | null> {
    try {
      const params = new URLSearchParams({ id: song.id, lv: '1', kv: '1', tv: '-1' });
      const data = asRecord(
        await fetchJsonWithTimeout(`https://music.163.com/api/song/lyric?${params.toString()}`, request.signal, neteaseHeaders, request.timeoutMs),
      );
      const providerText = splitLyricsByKind(lyricText(data.lrc));
      const instrumental = data.nolyric === true || data.needDesc === true;

      if (!instrumental && !providerText.syncedLyrics && !providerText.plainLyrics) {
        return null;
      }

      return {
        provider: 'netease',
        providerLyricsId: `netease:${song.id}`,
        title: song.title,
        artist: song.artist,
        album: song.album,
        durationSeconds: song.durationSeconds,
        instrumental,
        plainLyrics: providerText.plainLyrics,
        syncedLyrics: providerText.syncedLyrics,
        translationLyrics: lyricText(data.tlyric),
        romanizationLyrics: lyricText(data.romalrc),
        sourceUrl: `https://music.163.com/#/song?id=${encodeURIComponent(song.id)}`,
        sourceLabel: 'NetEase',
        matchReasons: ['netease_provider'],
        raw: {
          song: song.raw,
          lyric: data,
        },
      };
    } catch {
      return null;
    }
  }
}
