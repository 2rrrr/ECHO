import { Buffer } from 'node:buffer';
import type { LyricsQuery } from '../../shared/types/lyrics';
import { asRecord, fetchJsonWithTimeout, number, text } from '../library/network/providers/providerFetch';
import type { LyricsProvider, LyricsProviderCapability, LyricsProviderResult, LyricsProviderSearchRequest } from './LyricsProvider';
import { parseSyncedLyrics } from './lyricsParser';

const qqHeaders = {
  Referer: 'https://y.qq.com/',
  Origin: 'https://y.qq.com',
};

type QQSong = {
  mid: string;
  id: string | null;
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number | null;
  raw: unknown;
};

const maybeDecodeBase64 = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) {
    return null;
  }

  if (raw.includes('[') || raw.includes('\n') || /[\u4e00-\u9fff]/u.test(raw) || raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(raw)) {
    return raw;
  }

  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8').trim();
    return decoded || raw;
  } catch {
    return raw;
  }
};

const splitLyricsByKind = (value: string | null): { syncedLyrics: string | null; plainLyrics: string | null } => {
  if (!value) {
    return { syncedLyrics: null, plainLyrics: null };
  }

  return parseSyncedLyrics(value).length > 0
    ? { syncedLyrics: value, plainLyrics: null }
    : { syncedLyrics: null, plainLyrics: value };
};

const searchQueryFor = (query: LyricsQuery): string => [query.title, query.artist].filter(Boolean).join(' ').trim();

export class QQMusicLyricsProvider implements LyricsProvider {
  readonly id = 'qqmusic' as const;
  readonly label = 'QQ Music';
  readonly priority = 590;
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

  private async searchSongs(request: LyricsProviderSearchRequest): Promise<QQSong[]> {
    const seen = new Set<string>();
    const songs: QQSong[] = [];

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

      const params = new URLSearchParams({
        ct: '24',
        qqmusic_ver: '1298',
        new_json: '1',
        remoteplace: 'txt.yqq.song',
        t: '0',
        aggr: '1',
        cr: '1',
        catZhida: '1',
        lossless: '0',
        flag_qc: '0',
        p: '1',
        n: '5',
        w: query,
        format: 'json',
      });
      const data = asRecord(
        await fetchJsonWithTimeout(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?${params.toString()}`, request.signal, qqHeaders, request.timeoutMs),
      );
      const songData = asRecord(asRecord(data.data).song);
      const songValues = Array.isArray(songData.list) ? songData.list : [];

      for (const songValue of songValues) {
        const song = asRecord(songValue);
        const mid = text(song.mid) ?? text(song.songmid);
        if (!mid || seen.has(mid)) {
          continue;
        }

        const singers = Array.isArray(song.singer) ? song.singer.map(asRecord) : [];
        const artist = singers.map((singer) => text(singer.name)).filter(Boolean).join(' / ');
        const album = asRecord(song.album);

        seen.add(mid);
        songs.push({
          mid,
          id: song.id == null ? null : String(song.id),
          title: text(song.name) ?? text(song.title) ?? request.query.title,
          artist: artist || request.query.artist,
          album: text(album.name) ?? text(album.title),
          durationSeconds: number(song.interval),
          raw: songValue,
        });
      }
    }

    return songs;
  }

  private async fetchLyrics(song: QQSong, request: LyricsProviderSearchRequest): Promise<LyricsProviderResult | null> {
    try {
      const params = new URLSearchParams({
        songmid: song.mid,
        pcachetime: String(Date.now()),
        g_tk: '5381',
        loginUin: '0',
        hostUin: '0',
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: '0',
        platform: 'yqq',
        needNewCode: '0',
        nobase64: '1',
      });
      const data = asRecord(
        await fetchJsonWithTimeout(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${params.toString()}`, request.signal, qqHeaders, request.timeoutMs),
      );
      const providerText = splitLyricsByKind(maybeDecodeBase64(data.lyric));

      if (!providerText.syncedLyrics && !providerText.plainLyrics) {
        return null;
      }

      return {
        provider: 'qqmusic',
        providerLyricsId: `qqmusic:${song.mid}`,
        title: song.title,
        artist: song.artist,
        album: song.album,
        durationSeconds: song.durationSeconds,
        instrumental: false,
        plainLyrics: providerText.plainLyrics,
        syncedLyrics: providerText.syncedLyrics,
        translationLyrics: maybeDecodeBase64(data.trans),
        romanizationLyrics: maybeDecodeBase64(data.roma),
        sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${encodeURIComponent(song.mid)}`,
        sourceLabel: 'QQ Music',
        matchReasons: ['qqmusic_provider'],
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
