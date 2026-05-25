import type { ArtistConcertEvent, ArtistConcertInfo } from '../../../shared/types/library';
import type { EchoDatabase } from '../../database/createDatabase';
import { fetchWithNetworkProxy } from '../../network/networkFetch';

type FetchLike = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}>;

export type BandsintownEventsRequest = {
  artistId?: string | null;
  artistName: string;
  appId: string | null | undefined;
  region?: string | null;
  force?: boolean;
  timeoutMs?: number;
  fetcher?: FetchLike;
  now?: Date;
};

export type TicketmasterEventsRequest = {
  artistId?: string | null;
  artistName: string;
  apiKey: string | null | undefined;
  region?: string | null;
  force?: boolean;
  timeoutMs?: number;
  fetcher?: FetchLike;
  now?: Date;
};

export type ArtistEventsRequest = {
  artistId?: string | null;
  artistName: string;
  bandsintownAppId?: string | null;
  ticketmasterApiKey?: string | null;
  region?: string | null;
  force?: boolean;
  timeoutMs?: number;
  fetcher?: FetchLike;
  now?: Date;
};

type BandsintownVenue = {
  name?: unknown;
  city?: unknown;
  region?: unknown;
  country?: unknown;
};

type BandsintownEvent = {
  id?: unknown;
  title?: unknown;
  datetime?: unknown;
  timezone?: unknown;
  url?: unknown;
  offers?: unknown;
  venue?: unknown;
};

type TicketmasterEvent = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  dates?: unknown;
  _embedded?: unknown;
  images?: unknown;
};

type EventernoteEventsRequest = {
  artistId?: string | null;
  artistName: string;
  region?: string | null;
  force?: boolean;
  timeoutMs?: number;
  fetcher?: FetchLike;
  now?: Date;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeFilterText = (value: string): string => value.trim().toLocaleLowerCase();
const successTtlMs = 30 * 24 * 60 * 60 * 1000;
const shortTtlMs = 60 * 60 * 1000;
const fallbackTtlMs = 12 * 60 * 60 * 1000;
const maxFallbackEvents = 12;
const eventernoteBaseUrl = 'https://www.eventernote.com';
let lastFallbackFetchAt = 0;

const normalizeCacheText = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const cacheKeyFor = (source: ArtistConcertEvent['source'], artistId: string | null | undefined, artistName: string, region: string | null): string =>
  `${source}:${artistId?.trim() || normalizeCacheText(artistName)}:${normalizeCacheText(region)}`;

const decodeHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/gu, ' ')
    .trim();

const eventernoteSearchUrl = (artistName: string): string => {
  const params = new URLSearchParams({
    keyword: artistName.trim(),
    facet: '1',
    limit: '30',
    sort: 'event_date',
    order: 'ASC',
  });
  return `${eventernoteBaseUrl}/events/search?${params.toString()}`;
};

const eventernoteCandidateUrls = (artistName: string): string[] => {
  const normalized = normalizeCacheText(artistName);
  const urls = [eventernoteSearchUrl(artistName)];
  if (normalized === 'mygo') {
    urls.unshift(`${eventernoteBaseUrl}/actors/MyGO%21%21%21%21%21/66346`);
  }
  return Array.from(new Set(urls));
};

const fallbackSourceCandidates = (artistName: string): NonNullable<ArtistConcertInfo['candidateSources']> => [
  {
    source: 'eventernote',
    label: 'Eventernote',
    url: eventernoteSearchUrl(artistName),
  },
  {
    source: 'songkick',
    label: 'Songkick',
    url: `https://www.songkick.com/search?query=${encodeURIComponent(artistName.trim())}`,
  },
  {
    source: 'eplus',
    label: 'eplus',
    url: `https://eplus.jp/sf/search?keyword=${encodeURIComponent(artistName.trim())}`,
  },
];

const matchesRegion = (event: ArtistConcertEvent, region: string | null | undefined): boolean => {
  const filter = normalizeFilterText(region ?? '');
  if (!filter) {
    return true;
  }

  return [event.city, event.region, event.country]
    .filter((part): part is string => Boolean(part))
    .some((part) => normalizeFilterText(part).includes(filter));
};

const buildBandsintownEventsUrl = (artistName: string, appId: string): string => {
  const encodedArtist = encodeURIComponent(artistName.trim());
  const params = new URLSearchParams({
    app_id: appId.trim(),
    date: 'upcoming',
  });
  return `https://rest.bandsintown.com/artists/${encodedArtist}/events?${params.toString()}`;
};

const buildTicketmasterEventsUrl = (artistName: string, apiKey: string): string => {
  const params = new URLSearchParams({
    apikey: apiKey.trim(),
    keyword: artistName.trim(),
    classificationName: 'music',
    size: '20',
    sort: 'date,asc',
  });
  return `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
};

const firstOfferUrl = (value: unknown): string | null => {
  const offers = Array.isArray(value) ? value.map(asRecord) : [];
  for (const offer of offers) {
    const url = text(offer.url);
    if (url) {
      return url;
    }
  }
  return null;
};

const parseBandsintownEvent = (value: unknown): ArtistConcertEvent | null => {
  const event = asRecord(value) as BandsintownEvent;
  const id = text(event.id);
  const startsAt = text(event.datetime);
  if (!id || !startsAt) {
    return null;
  }

  const venue = asRecord(event.venue) as BandsintownVenue;
  const venueName = text(venue.name);
  const city = text(venue.city);
  const region = text(venue.region);
  const country = text(venue.country);
  const fallbackTitle = [venueName, city].filter(Boolean).join(' - ') || 'Bandsintown event';
  const title = text(event.title) ?? fallbackTitle;

  return {
    id: `bandsintown:${id}`,
    source: 'bandsintown',
    sourceLabel: 'Bandsintown',
    title,
    startsAt,
    timezone: text(event.timezone),
    timeTbd: false,
    venueName,
    city,
    region,
    country,
    url: text(event.url),
    ticketUrl: firstOfferUrl(event.offers),
    venueUrl: null,
  };
};

const parseTicketmasterDate = (datesValue: unknown): { startsAt: string | null; timezone: string | null; timeTbd: boolean } => {
  const dates = asRecord(datesValue);
  const start = asRecord(dates.start);
  const dateTime = text(start.dateTime);
  const localDate = text(start.localDate);
  const localTime = text(start.localTime);
  return {
    startsAt: dateTime ?? (localDate ? `${localDate}T${localTime ?? '00:00:00'}` : null),
    timezone: text(dates.timezone),
    timeTbd: Boolean(start.dateTBD) || Boolean(start.noSpecificTime),
  };
};

const ticketmasterImageUrl = (imagesValue: unknown): string | null => {
  const images = Array.isArray(imagesValue) ? imagesValue.map(asRecord) : [];
  const scored = images
    .map((image) => {
      const url = text(image.url);
      const width = Number(image.width ?? 0);
      const height = Number(image.height ?? 0);
      if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
      }
      const ratio = width / height;
      const landscapeBonus = ratio >= 1.4 ? 10000 : 0;
      return { url, score: landscapeBonus + width * height };
    })
    .filter((image): image is { url: string; score: number } => Boolean(image))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.url ?? null;
};

const parseTicketmasterEvent = (value: unknown): ArtistConcertEvent | null => {
  const event = asRecord(value) as TicketmasterEvent;
  const id = text(event.id);
  const title = text(event.name);
  const { startsAt, timezone, timeTbd } = parseTicketmasterDate(event.dates);
  if (!id || !title || !startsAt) {
    return null;
  }

  const embedded = asRecord(event._embedded);
  const venues = Array.isArray(embedded.venues) ? embedded.venues.map(asRecord) : [];
  const venue = venues[0] ?? {};
  const city = asRecord(venue.city);
  const state = asRecord(venue.state);
  const country = asRecord(venue.country);

  return {
    id: `ticketmaster:${id}`,
    source: 'ticketmaster',
    sourceLabel: 'Ticketmaster',
    title,
    startsAt,
    timezone,
    timeTbd,
    venueName: text(venue.name),
    city: text(city.name),
    region: text(state.stateCode) ?? text(state.name),
    country: text(country.countryCode) ?? text(country.name),
    url: text(event.url),
    ticketUrl: text(event.url),
    venueUrl: text(venue.url),
    imageUrl: ticketmasterImageUrl(event.images),
  };
};

const eventernoteStartsAt = (dateText: string, block: string): string | null => {
  const time = block.match(/開演\s*(\d{1,2}):(\d{2})/u);
  const hour = time?.[1]?.padStart(2, '0') ?? '00';
  const minute = time?.[2] ?? '00';
  return /^\d{4}-\d{2}-\d{2}$/u.test(dateText) ? `${dateText}T${hour}:${minute}:00` : null;
};

const parseEventernoteEvents = (html: string, request: Pick<EventernoteEventsRequest, 'artistName' | 'region' | 'now'>): ArtistConcertEvent[] => {
  const now = request.now ?? new Date();
  const blocks = html.match(/<li class="clearfix[\s\S]*?(?=<li class="clearfix|\n\s*<\/ul>\s*<\/div>)/gu) ?? [];
  const events: ArtistConcertEvent[] = [];
  const artistNeedle = normalizeCacheText(request.artistName);

  for (const block of blocks) {
    const date = block.match(/<p class="day\d*">(\d{4}-\d{2}-\d{2})/u)?.[1] ?? null;
    const eventLink = block.match(/<h4>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h4>/u);
    const venueMatch = block.match(/会場:\s*<a [^>]*>([\s\S]*?)<\/a>/u);
    const imageMatch = block.match(/<img src="([^"]+)"[^>]*alt="([^"]*)"/u);
    const eventId = eventLink?.[1]?.match(/\/events\/(\d+)/u)?.[1] ?? null;
    const title = eventLink ? decodeHtml(eventLink[2]) : null;
    const startsAt = date ? eventernoteStartsAt(date, block) : null;

    if (!eventLink || !eventId || !title || !startsAt || Date.parse(startsAt) < now.getTime()) {
      continue;
    }

    const blockText = normalizeCacheText(decodeHtml(block));
    if (artistNeedle && !blockText.includes(artistNeedle)) {
      continue;
    }

    const url = new URL(eventLink[1], eventernoteBaseUrl).toString();
    const imageUrl = imageMatch?.[1] ? new URL(imageMatch[1], eventernoteBaseUrl).toString() : null;
    const venueName = venueMatch ? decodeHtml(venueMatch[1]) || null : null;
    const event: ArtistConcertEvent = {
      id: `eventernote:${eventId}`,
      source: 'eventernote',
      sourceLabel: 'Eventernote',
      title,
      startsAt,
      timezone: 'Asia/Tokyo',
      timeTbd: false,
      venueName,
      city: null,
      region: null,
      country: 'Japan',
      url,
      ticketUrl: url,
      venueUrl: null,
      imageUrl,
    };

    if (matchesRegion(event, request.region)) {
      events.push(event);
    }
  }

  return events
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, maxFallbackEvents);
};

const fetchJsonWithTimeout = async (url: string, fetcher: FetchLike, timeoutMs: number, source: ArtistConcertEvent['source']): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ECHO-Next/26.5.19',
      },
    });
    if (!response.ok) {
      throw new Error(`${source}_request_failed:${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fetchTextWithTimeout = async (url: string, fetcher: FetchLike, timeoutMs: number, source: ArtistConcertEvent['source']): Promise<string> => {
  const waitMs = Math.max(0, 1200 - (Date.now() - lastFallbackFetchAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastFallbackFetchAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'ECHO-Next/26.5.19',
      },
    });
    if (!response.ok) {
      throw new Error(`${source}_request_failed:${response.status}`);
    }
    if (!response.text) {
      throw new Error(`${source}_text_unavailable`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
  }
};

export class ArtistEventsService {
  constructor(
    private readonly fetcher: FetchLike = fetchWithNetworkProxy as FetchLike,
    private readonly database: EchoDatabase | null = null,
  ) {}

  async getArtistEvents(request: ArtistEventsRequest): Promise<ArtistConcertInfo> {
    const artistName = request.artistName.trim();
    const region = request.region?.trim() || null;
    const now = request.now ?? new Date();
    const tasks: Array<Promise<ArtistConcertInfo>> = [];

    if (request.bandsintownAppId?.trim()) {
      tasks.push(this.getBandsintownEvents({
        artistId: request.artistId,
        artistName,
        appId: request.bandsintownAppId,
        region,
        force: request.force,
        timeoutMs: request.timeoutMs,
        fetcher: request.fetcher,
        now,
      }));
    }

    if (request.ticketmasterApiKey?.trim()) {
      tasks.push(this.getTicketmasterEvents({
        artistId: request.artistId,
        artistName,
        apiKey: request.ticketmasterApiKey,
        region,
        force: request.force,
        timeoutMs: request.timeoutMs,
        fetcher: request.fetcher,
        now,
      }));
    }

    if (!artistName || tasks.length === 0) {
      return {
        status: 'not_configured',
        region,
        sources: [],
        events: [],
        fetchedAt: null,
        message: 'Configure artist event providers in Settings to load concerts.',
      };
    }

    const results = await Promise.all(tasks);
    if (results.every((result) => result.events.length === 0)) {
      results.push(await this.getEventernoteEvents({
        artistId: request.artistId,
        artistName,
        region,
        force: request.force,
        timeoutMs: Math.min(request.timeoutMs ?? 7000, 4500),
        fetcher: request.fetcher,
        now,
      }));
    }

    const sources = Array.from(new Set(results.flatMap((result) => result.sources)));
    const deduped = new Map<string, ArtistConcertEvent>();
    for (const event of results.flatMap((result) => result.events)) {
      const key = [
        normalizeCacheText(event.title),
        normalizeCacheText(event.venueName),
        normalizeCacheText(event.city),
        event.startsAt,
      ].join(':');
      if (!deduped.has(key)) {
        deduped.set(key, event);
      }
    }

    const events = Array.from(deduped.values()).sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
    const status = results.some((result) => result.status === 'ready')
      ? 'ready'
      : results.some((result) => result.status === 'unavailable')
        ? 'unavailable'
        : 'not_configured';

    return {
      status,
      region,
      sources,
      events,
      fetchedAt: results.find((result) => result.fetchedAt)?.fetchedAt ?? now.toISOString(),
      message: status === 'unavailable' ? results.find((result) => result.message)?.message : undefined,
      candidateSources: results.flatMap((result) => result.candidateSources ?? []),
    };
  }

  async getEventernoteEvents(request: EventernoteEventsRequest): Promise<ArtistConcertInfo> {
    const artistName = request.artistName.trim();
    const region = request.region?.trim() || null;
    const now = request.now ?? new Date();
    const fetchedAt = now.toISOString();
    const cacheKey = cacheKeyFor('eventernote', request.artistId, artistName, region);

    if (!artistName) {
      return {
        status: 'not_configured',
        region,
        sources: [],
        events: [],
        fetchedAt: null,
        message: 'Artist name is empty.',
      };
    }

    if (request.force !== true) {
      const cached = this.readEventCache(cacheKey, now);
      if (cached) {
        return cached;
      }
    }

    try {
      const fetchedEvents: ArtistConcertEvent[] = [];
      for (const url of eventernoteCandidateUrls(artistName)) {
        const html = await fetchTextWithTimeout(
          url,
          request.fetcher ?? this.fetcher,
          request.timeoutMs ?? 4500,
          'eventernote',
        );
        fetchedEvents.push(...parseEventernoteEvents(html, { artistName, region, now }));
        if (fetchedEvents.length > 0) {
          break;
        }
      }

      const deduped = new Map<string, ArtistConcertEvent>();
      for (const event of fetchedEvents) {
        deduped.set(event.id, event);
      }
      const events = Array.from(deduped.values())
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
        .slice(0, maxFallbackEvents);

      const result: ArtistConcertInfo = {
        status: 'ready',
        region,
        sources: ['eventernote'],
        events,
        fetchedAt,
        message: events.length ? undefined : 'No upcoming Eventernote events matched this artist and region.',
        candidateSources: fallbackSourceCandidates(artistName),
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    } catch (error) {
      const result: ArtistConcertInfo = {
        status: 'unavailable',
        region,
        sources: ['eventernote'],
        events: [],
        fetchedAt,
        message: error instanceof Error ? error.message : String(error),
        candidateSources: fallbackSourceCandidates(artistName),
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    }
  }

  async getBandsintownEvents(request: BandsintownEventsRequest): Promise<ArtistConcertInfo> {
    const artistName = request.artistName.trim();
    const appId = request.appId?.trim() ?? '';
    const region = request.region?.trim() || null;
    const now = request.now ?? new Date();
    const fetchedAt = now.toISOString();
    const cacheKey = cacheKeyFor('bandsintown', request.artistId, artistName, region);

    if (!artistName || !appId) {
      return {
        status: 'not_configured',
        region,
        sources: [],
        events: [],
        fetchedAt: null,
        message: 'Configure Bandsintown app_id in Settings to load upcoming concerts.',
      };
    }

    if (request.force !== true) {
      const cached = this.readEventCache(cacheKey, now);
      if (cached) {
        return cached;
      }
    }

    try {
      const payload = await fetchJsonWithTimeout(
        buildBandsintownEventsUrl(artistName, appId),
        request.fetcher ?? this.fetcher,
        request.timeoutMs ?? 7000,
        'bandsintown',
      );
      const events = (Array.isArray(payload) ? payload : [])
        .map(parseBandsintownEvent)
        .filter((event): event is ArtistConcertEvent => Boolean(event))
        .filter((event) => matchesRegion(event, region))
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

      const result: ArtistConcertInfo = {
        status: 'ready',
        region,
        sources: ['bandsintown'],
        events,
        fetchedAt,
        message: events.length ? undefined : 'No upcoming Bandsintown events matched this artist and region.',
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    } catch (error) {
      const result: ArtistConcertInfo = {
        status: 'unavailable',
        region,
        sources: ['bandsintown'],
        events: [],
        fetchedAt,
        message: error instanceof Error ? error.message : String(error),
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    }
  }

  async getTicketmasterEvents(request: TicketmasterEventsRequest): Promise<ArtistConcertInfo> {
    const artistName = request.artistName.trim();
    const apiKey = request.apiKey?.trim() ?? '';
    const region = request.region?.trim() || null;
    const now = request.now ?? new Date();
    const fetchedAt = now.toISOString();
    const cacheKey = cacheKeyFor('ticketmaster', request.artistId, artistName, region);

    if (!artistName || !apiKey) {
      return {
        status: 'not_configured',
        region,
        sources: [],
        events: [],
        fetchedAt: null,
        message: 'Configure Ticketmaster apikey in Settings to load upcoming concerts.',
      };
    }

    if (request.force !== true) {
      const cached = this.readEventCache(cacheKey, now);
      if (cached) {
        return cached;
      }
    }

    try {
      const payload = await fetchJsonWithTimeout(
        buildTicketmasterEventsUrl(artistName, apiKey),
        request.fetcher ?? this.fetcher,
        request.timeoutMs ?? 7000,
        'ticketmaster',
      );
      const embedded = asRecord(asRecord(payload)._embedded);
      const events = (Array.isArray(embedded.events) ? embedded.events : [])
        .map(parseTicketmasterEvent)
        .filter((event): event is ArtistConcertEvent => Boolean(event))
        .filter((event) => matchesRegion(event, region))
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

      const result: ArtistConcertInfo = {
        status: 'ready',
        region,
        sources: ['ticketmaster'],
        events,
        fetchedAt,
        message: events.length ? undefined : 'No upcoming Ticketmaster events matched this artist and region.',
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    } catch (error) {
      const result: ArtistConcertInfo = {
        status: 'unavailable',
        region,
        sources: ['ticketmaster'],
        events: [],
        fetchedAt,
        message: error instanceof Error ? error.message : String(error),
      };
      this.writeEventCache(cacheKey, request.artistId ?? null, artistName, region, result, now);
      return result;
    }
  }

  clearCache(): { removedRows: number } {
    if (!this.database) {
      return { removedRows: 0 };
    }
    const removedRows = Number(this.database.prepare('DELETE FROM artist_event_cache').run().changes ?? 0);
    return { removedRows };
  }

  private readEventCache(cacheKey: string, now: Date): ArtistConcertInfo | null {
    if (!this.database) {
      return null;
    }
    const row = this.database.prepare<[string], Record<string, unknown>>('SELECT * FROM artist_event_cache WHERE cache_key = ?').get(cacheKey);
    if (!row || Date.parse(text(row.expires_at) ?? '') <= now.getTime()) {
      return null;
    }
    const status = row.status === 'ready' || row.status === 'unavailable' ? row.status : 'unavailable';
    return {
      status,
      region: text(row.region),
      sources: parseJson<ArtistConcertInfo['sources']>(row.sources_json, []),
      events: parseJson<ArtistConcertEvent[]>(row.events_json, []),
      fetchedAt: text(row.fetched_at),
      message: text(row.message) ?? undefined,
    };
  }

  private writeEventCache(cacheKey: string, artistId: string | null, artistName: string, region: string | null, info: ArtistConcertInfo, now: Date): void {
    if (!this.database) {
      return;
    }
    const hasData = info.events.length > 0;
    const expiresAt = new Date(now.getTime() + (hasData ? successTtlMs : shortTtlMs)).toISOString();
    this.database
      .prepare(
        `INSERT INTO artist_event_cache (
          cache_key, artist_id, normalized_name, region, source, events_json, sources_json, status, message, fetched_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          artist_id = excluded.artist_id,
          normalized_name = excluded.normalized_name,
          region = excluded.region,
          source = excluded.source,
          events_json = excluded.events_json,
          sources_json = excluded.sources_json,
          status = excluded.status,
          message = excluded.message,
          fetched_at = excluded.fetched_at,
          expires_at = excluded.expires_at`,
      )
      .run(
        cacheKey,
        artistId,
        normalizeCacheText(artistName),
        region,
        info.sources[0] ?? 'bandsintown',
        JSON.stringify(info.events),
        JSON.stringify(info.sources),
        info.status,
        info.message ?? null,
        info.fetchedAt ?? now.toISOString(),
        expiresAt,
      );
  }
}
