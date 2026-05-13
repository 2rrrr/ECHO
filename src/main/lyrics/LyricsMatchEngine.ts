import { randomUUID } from 'node:crypto';
import type { LyricsProviderId, LyricsQuery } from '../../shared/types/lyrics';
import type { LyricsProvider, LyricsProviderResult } from './LyricsProvider';
import { dedupeLyricsCandidates, sortLyricsCandidates, type DedupableLyricsCandidate } from './lyricsCandidateDedup';
import { buildNormalizedLyricsQuery, type NormalizedLyricsQuery } from './lyricsQueryBuilder';
import { evaluateLyricsCandidate, type LyricsMatchDecision } from './lyricsScoring';

export type LyricsMatchEngineOptions = {
  enabledProviders: LyricsProviderId[];
  networkEnabled: boolean;
  providerTimeoutMs: number;
  totalMatchTimeoutMs: number;
  autoAcceptScore: number;
  coverAutoAcceptScore: number;
  isRejected?: (provider: LyricsProviderId, providerLyricsId: string | null) => boolean;
};

export type MatchedLyricsCandidate = DedupableLyricsCandidate & {
  decision: LyricsMatchDecision;
  providerResult: LyricsProviderResult;
};

export type LyricsMatchEngineResult = {
  normalized: NormalizedLyricsQuery;
  accepted: MatchedLyricsCandidate | null;
  candidates: MatchedLyricsCandidate[];
};

const defaultOptions: LyricsMatchEngineOptions = {
  enabledProviders: ['local', 'lrclib'],
  networkEnabled: true,
  providerTimeoutMs: 4500,
  totalMatchTimeoutMs: 6000,
  autoAcceptScore: 0.7,
  coverAutoAcceptScore: 0.97,
};

const providerPriorityBonus = (provider: LyricsProvider): number => Math.min(0.01, Math.max(0, provider.priority / 100000));

const sanitizeQueryForProvider = (query: LyricsQuery, provider: LyricsProvider): LyricsQuery =>
  provider.id === 'local'
    ? query
    : {
        trackId: query.trackId,
        title: query.title,
        artist: query.artist,
        album: query.album ?? null,
        durationSeconds: query.durationSeconds ?? null,
        filePath: null,
      };

const mergeSignals = (parent: AbortSignal, child: AbortController): (() => void) => {
  const abort = (): void => child.abort();
  parent.addEventListener('abort', abort, { once: true });
  return () => parent.removeEventListener('abort', abort);
};

export class LyricsMatchEngine {
  constructor(private readonly providers: LyricsProvider[]) {}

  async match(query: LyricsQuery, options: Partial<LyricsMatchEngineOptions> = {}): Promise<LyricsMatchEngineResult> {
    const settings = { ...defaultOptions, ...options };
    const normalized = buildNormalizedLyricsQuery(query);
    const enabled = new Set(settings.enabledProviders);
    const localProviders = this.providers.filter((provider) => provider.id === 'local' && enabled.has(provider.id));
    const networkProviders = settings.networkEnabled
      ? this.providers.filter((provider) => provider.id !== 'local' && enabled.has(provider.id))
      : [];

    for (const provider of localProviders) {
      const localCandidates = await this.searchProvider(provider, query, normalized, settings, new AbortController().signal);
      if (localCandidates.length) {
        const sorted = sortLyricsCandidates(normalized.durationSeconds, dedupeLyricsCandidates(localCandidates));
        return {
          normalized,
          accepted: sorted[0],
          candidates: sorted,
        };
      }
    }

    if (!networkProviders.length) {
      return { normalized, accepted: null, candidates: [] };
    }

    const totalController = new AbortController();
    const totalTimer = setTimeout(() => totalController.abort(), settings.totalMatchTimeoutMs);
    const pending = new Map<LyricsProviderId, Promise<MatchedLyricsCandidate[]>>();
    const collected: MatchedLyricsCandidate[] = [];
    let accepted: MatchedLyricsCandidate | null = null;

    for (const provider of networkProviders) {
      pending.set(provider.id, this.searchProvider(provider, query, normalized, settings, totalController.signal));
    }

    try {
      while (pending.size && !totalController.signal.aborted) {
        const next = await Promise.race(
          Array.from(pending.entries()).map(async ([id, promise]) => ({
            id,
            candidates: await promise.catch(() => [] as MatchedLyricsCandidate[]),
          })),
        );
        pending.delete(next.id);
        collected.push(...next.candidates);
        const sorted = sortLyricsCandidates(normalized.durationSeconds, dedupeLyricsCandidates(collected));
        accepted = sorted.find((candidate) => candidate.decision.autoAccept && candidate.decision.risk === 'low') ?? null;
        if (accepted) {
          totalController.abort();
          break;
        }
      }
    } finally {
      clearTimeout(totalTimer);
    }

    const candidates = sortLyricsCandidates(normalized.durationSeconds, dedupeLyricsCandidates(collected));
    return {
      normalized,
      accepted: accepted ?? candidates.find((candidate) => candidate.decision.autoAccept && candidate.decision.risk === 'low') ?? null,
      candidates,
    };
  }

  private async searchProvider(
    provider: LyricsProvider,
    query: LyricsQuery,
    normalized: NormalizedLyricsQuery,
    settings: LyricsMatchEngineOptions,
    totalSignal: AbortSignal,
  ): Promise<MatchedLyricsCandidate[]> {
    const controller = new AbortController();
    const detach = mergeSignals(totalSignal, controller);
    const timer = setTimeout(() => controller.abort(), settings.providerTimeoutMs);

    try {
      const results = await provider.search({
        query: sanitizeQueryForProvider(query, provider),
        normalized,
        timeoutMs: settings.providerTimeoutMs,
        signal: controller.signal,
      });

      return results
        .map((result) => this.resultToCandidate(provider, normalized, result, settings))
        .filter((candidate): candidate is MatchedLyricsCandidate => Boolean(candidate));
    } catch {
      return [];
    } finally {
      detach();
      clearTimeout(timer);
    }
  }

  private resultToCandidate(
    provider: LyricsProvider,
    normalized: NormalizedLyricsQuery,
    result: LyricsProviderResult,
    settings: LyricsMatchEngineOptions,
  ): MatchedLyricsCandidate | null {
    if (!result.title || !result.artist) {
      return null;
    }

    const rejectedByUser = settings.isRejected?.(provider.id, result.providerLyricsId) ?? false;
    const base = {
      provider: provider.id,
      providerLyricsId: result.providerLyricsId,
      title: result.title,
      artist: result.artist,
      album: result.album,
      durationSeconds: result.durationSeconds,
      instrumental: result.instrumental,
      hasSynced: Boolean(result.syncedLyrics || result.instrumental),
      hasPlain: Boolean(result.plainLyrics),
      sourceLabel: result.sourceLabel ?? provider.label,
    };
    const decision = provider.id === 'local'
      ? {
          score: 1,
          autoAccept: true,
          candidateOnly: false,
          rejected: false,
          risk: 'low' as const,
          reasons: result.matchReasons?.length ? result.matchReasons : ['local_sidecar_priority'],
          providerPriorityBonus: providerPriorityBonus(provider),
          titleScore: 1,
          artistScore: 1,
          albumScore: 1,
          durationScore: 1,
          versionScore: 1,
        }
      : evaluateLyricsCandidate(normalized, base, {
          autoAcceptScore: settings.autoAcceptScore,
          coverAutoAcceptScore: settings.coverAutoAcceptScore,
          providerPriorityBonus: providerPriorityBonus(provider),
          rejectedByUser,
        });

    if (decision.autoAccept) {
      decision.reasons.push('auto_accept');
    }

    return {
      id: randomUUID(),
      ...base,
      score: decision.score,
      risk: decision.risk,
      reasons: decision.reasons,
      titleScore: decision.titleScore,
      artistScore: decision.artistScore,
      albumScore: decision.albumScore,
      durationScore: decision.durationScore,
      versionScore: decision.versionScore,
      raw: result.raw ?? result,
      providerPriority: provider.priority,
      decision,
      providerResult: result,
    };
  }
}
