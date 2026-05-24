import type { LyricLine, LyricWordTiming, LyricsKind } from '../../shared/types/lyrics';

const metadataTagPattern = /^\s*\[(ar|ti|al|by|offset|length|re|ve):[^\]]*\]\s*$/i;
const timestampPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const leadingTimestampsPattern = /^\s*(?:(?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])\s*)+/;
const angleTimestampPattern = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;
const enhancedTimestampPattern = /<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g;
const neteaseYrcLinePattern = /^\s*\[(\d+),(\d+)\](.*)$/;
const neteaseYrcWordPattern = /\((\d+),(\d+)(?:,\d+)?\)/g;

const fractionToMs = (fraction: string | undefined): number => {
  if (!fraction) {
    return 0;
  }

  if (fraction.length === 1) {
    return Number(fraction) * 100;
  }

  if (fraction.length === 2) {
    return Number(fraction) * 10;
  }

  return Number(fraction.slice(0, 3));
};

const parseTimestamp = (match: RegExpMatchArray): number | null => {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = fractionToMs(match[3]);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }

  return minutes * 60_000 + seconds * 1000 + milliseconds;
};

const cleanLyricText = (text: string): string =>
  text
    .replace(enhancedTimestampPattern, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanBracketTimestampedLyricText = (text: string): string => cleanLyricText(text.replace(timestampPattern, ''));
const normalizeTimedSegmentText = (text: string): string => text.replace(/\s+/g, ' ');

type TimedSegment = {
  text: string;
  startMs: number;
  endMs: number | null;
};

const normalizeWordTimings = (segments: TimedSegment[]): LyricWordTiming[] | undefined => {
  const words: LyricWordTiming[] = [];

  for (const segment of segments) {
    const text = normalizeTimedSegmentText(segment.text);
    if (!text.trim()) {
      continue;
    }

    if (!Number.isFinite(segment.startMs) || segment.startMs < 0) {
      return undefined;
    }

    if (segment.endMs !== null && (!Number.isFinite(segment.endMs) || segment.endMs <= segment.startMs)) {
      return undefined;
    }

    const previous = words[words.length - 1];
    if (previous && segment.startMs <= previous.startMs) {
      return undefined;
    }

    words.push({
      text,
      startMs: Math.round(segment.startMs),
      endMs: segment.endMs === null ? null : Math.round(segment.endMs),
    });
  }

  return words.length >= 2 ? words : undefined;
};

const normalizedTextIdentity = (value: string): string => value.replace(/\s+/g, ' ').trim();

const attachWordTimings = (
  line: Pick<LyricLine, 'text' | 'translation'>,
  words: LyricWordTiming[] | undefined,
): Pick<LyricLine, 'text' | 'translation' | 'words'> => {
  if (!words?.length) {
    return line;
  }

  const wordText = normalizedTextIdentity(words.map((word) => word.text).join(''));
  if (wordText !== normalizedTextIdentity(line.text)) {
    return line;
  }

  return { ...line, words };
};

const parseNeteaseYrcLine = (line: string): LyricLine | null => {
  const lineMatch = line.match(neteaseYrcLinePattern);
  if (!lineMatch) {
    return null;
  }

  const timeMs = Number(lineMatch[1]);
  const lineDurationMs = Number(lineMatch[2]);
  if (!Number.isFinite(timeMs) || !Number.isFinite(lineDurationMs) || timeMs < 0 || lineDurationMs < 0) {
    return null;
  }

  const content = lineMatch[3] ?? '';
  const matches = [...content.matchAll(neteaseYrcWordPattern)];
  const textOnlyLine = (): LyricLine | null => {
    const text = cleanLyricText(content.replace(neteaseYrcWordPattern, ''));
    return text ? { timeMs, ...splitInlineTranslation(text) } : null;
  };

  if (matches.length === 0) {
    return textOnlyLine();
  }

  const rawSegments: Array<{ text: string; rawStartMs: number; durationMs: number }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (match.index === undefined) {
      return textOnlyLine();
    }

    const rawStartMs = Number(match[1]);
    const durationMs = Number(match[2]);
    if (!Number.isFinite(rawStartMs) || !Number.isFinite(durationMs) || rawStartMs < 0 || durationMs < 0) {
      return textOnlyLine();
    }

    const textStart = match.index + match[0].length;
    const textEnd = matches[index + 1]?.index ?? content.length;
    rawSegments.push({ text: content.slice(textStart, textEnd), rawStartMs, durationMs });
  }

  const text = cleanLyricText(content.replace(neteaseYrcWordPattern, ''));
  if (!text) {
    return null;
  }

  const yrcTimingToleranceMs = 50;
  const usesRelativeWordTimes =
    lineDurationMs > 0 &&
    rawSegments.every((segment) => segment.rawStartMs + segment.durationMs <= lineDurationMs + yrcTimingToleranceMs);
  const segments: TimedSegment[] = rawSegments.map((segment) => {
    const startMs = usesRelativeWordTimes
      ? timeMs + segment.rawStartMs
      : segment.rawStartMs < timeMs && timeMs - segment.rawStartMs > 1000
        ? timeMs + segment.rawStartMs
        : segment.rawStartMs;

    return {
      text: segment.text,
      startMs,
      endMs: segment.durationMs > 0 ? startMs + segment.durationMs : null,
    };
  });

  return { timeMs, ...attachWordTimings(splitInlineTranslation(text), normalizeWordTimings(segments)) };
};

const parseAngleEnhancedWordTimings = (content: string): LyricWordTiming[] | undefined => {
  const matches = [...content.matchAll(angleTimestampPattern)];
  if (matches.length < 2) {
    return undefined;
  }

  const firstIndex = matches[0].index ?? 0;
  if (content.slice(0, firstIndex).trim()) {
    return undefined;
  }

  const segments: TimedSegment[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const startMs = parseTimestamp(match);
    if (startMs === null || match.index === undefined) {
      return undefined;
    }

    const textStart = match.index + match[0].length;
    const textEnd = matches[index + 1]?.index ?? content.length;
    const endMs = matches[index + 1] ? parseTimestamp(matches[index + 1]) : null;
    if (endMs === null && matches[index + 1]) {
      return undefined;
    }

    segments.push({
      text: content.slice(textStart, textEnd),
      startMs,
      endMs,
    });
  }

  return normalizeWordTimings(segments);
};

const parseBracketEnhancedWordTimings = (
  line: string,
  timestamps: RegExpMatchArray[],
  leadingMatches: RegExpMatchArray[],
): LyricWordTiming[] | undefined => {
  if (leadingMatches.length !== 1 || timestamps.length < 3) {
    return undefined;
  }

  const lastTimestamp = timestamps[timestamps.length - 1];
  const lastTimestampEnd = (lastTimestamp.index ?? -1) + lastTimestamp[0].length;
  if (lastTimestampEnd !== line.length) {
    return undefined;
  }

  const segments: TimedSegment[] = [];
  for (let index = 0; index < timestamps.length - 1; index += 1) {
    const match = timestamps[index];
    const nextMatch = timestamps[index + 1];
    const startMs = parseTimestamp(match);
    const endMs = parseTimestamp(nextMatch);
    if (startMs === null || endMs === null || match.index === undefined || nextMatch.index === undefined) {
      return undefined;
    }

    segments.push({
      text: line.slice(match.index + match[0].length, nextMatch.index),
      startMs,
      endMs,
    });
  }

  return normalizeWordTimings(segments);
};

const looksLikeBracketEnhancedLine = (
  line: string,
  timestamps: RegExpMatchArray[],
  leadingMatches: RegExpMatchArray[],
): boolean => {
  if (leadingMatches.length === 0 || timestamps.length < 4) {
    return false;
  }

  const lastTimestamp = timestamps[timestamps.length - 1];
  const lastTimestampEnd = (lastTimestamp.index ?? -1) + lastTimestamp[0].length;
  if (lastTimestampEnd !== line.length) {
    return false;
  }

  const timedSegments = timestamps
    .map((match, index) => {
      const textStart = (match.index ?? 0) + match[0].length;
      const textEnd = timestamps[index + 1]?.index ?? line.length;
      return cleanLyricText(line.slice(textStart, textEnd));
    })
    .filter((segment) => segment.length > 0);

  if (timedSegments.length < 2) {
    return false;
  }

  const shortSegments = timedSegments.filter((segment) => segment.length <= 12 && !/\s/u.test(segment));
  return shortSegments.length / timedSegments.length >= 0.7;
};

const hasHan = (value: string): boolean => /\p{Script=Han}/u.test(value);
const hasKana = (value: string): boolean => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
const hasLatin = (value: string): boolean => /\p{Script=Latin}/u.test(value);
const hasHangul = (value: string): boolean => /\p{Script=Hangul}/u.test(value);

const hasEastAsianScript = (value: string): boolean =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);

const normalizeLineText = (value: string | null | undefined): string | null => {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  return normalized.length > 0 ? normalized : null;
};

const looksLikeRomanizationText = (value: string): boolean =>
  hasLatin(value) &&
  !hasEastAsianScript(value) &&
  /^[\p{Script=Latin}\d\s'"’.,!?():;+\-/&]+$/u.test(value);

const englishLyricWordSignals = new Set([
  'a',
  'about',
  'again',
  'all',
  'always',
  'am',
  'and',
  'are',
  'away',
  'baby',
  'be',
  'been',
  'but',
  'can',
  'cant',
  'come',
  'could',
  'day',
  'do',
  'dont',
  'down',
  'dream',
  'feel',
  'feeling',
  'for',
  'from',
  'get',
  'girl',
  'go',
  'good',
  'got',
  'had',
  'have',
  'heart',
  'hello',
  'here',
  'how',
  'i',
  'if',
  'im',
  'in',
  'is',
  'it',
  'its',
  'just',
  'know',
  'let',
  'like',
  'love',
  'make',
  'me',
  'mistake',
  'my',
  'never',
  'night',
  'no',
  'not',
  'now',
  'of',
  'on',
  'one',
  'out',
  'say',
  'see',
  'she',
  'so',
  'some',
  'take',
  'that',
  'the',
  'there',
  'this',
  'time',
  'to',
  'up',
  'wait',
  'wanna',
  'want',
  'was',
  'we',
  'what',
  'when',
  'where',
  'who',
  'will',
  'with',
  'world',
  'would',
  'yeah',
  'you',
  'your',
]);

const normalizeEnglishSignalWord = (value: string): string => value.toLowerCase().replace(/[’']/gu, '');

const looksLikeEnglishLyricText = (value: string): boolean => {
  if (!hasLatin(value) || hasEastAsianScript(value)) {
    return false;
  }

  const words = value.match(/\p{Script=Latin}+(?:[’']\p{Script=Latin}+)?/gu) ?? [];
  if (words.length === 0) {
    return false;
  }

  const signalCount = words.filter((word) => englishLyricWordSignals.has(normalizeEnglishSignalWord(word))).length;
  return signalCount >= Math.max(1, Math.ceil(words.length * 0.5));
};

const looksLikeTranslationText = (primaryText: string, value: string): boolean => {
  if (!hasHan(value) || hasKana(value) || hasHangul(value)) {
    return false;
  }

  return hasKana(primaryText) || hasLatin(primaryText) || hasHangul(primaryText) || !hasHan(primaryText);
};

const splitInlineTranslation = (value: string): Pick<LyricLine, 'text' | 'translation'> => {
  const delimiterPattern = /\s*[\/／]\s*/g;
  for (const match of value.matchAll(delimiterPattern)) {
    const delimiterIndex = match.index ?? -1;
    if (delimiterIndex <= 0) {
      continue;
    }

    const primaryText = normalizeLineText(value.slice(0, delimiterIndex));
    const translationText = normalizeLineText(value.slice(delimiterIndex + match[0].length));
    if (!primaryText || !translationText) {
      continue;
    }

    if (looksLikeTranslationText(primaryText, translationText)) {
      return { text: primaryText, translation: translationText };
    }
  }

  return { text: value };
};

const classifyAlternateLine = (
  primaryText: string,
  value: string,
  usedFields: Set<'romanization' | 'translation'>,
): 'romanization' | 'translation' | null => {
  if (!usedFields.has('romanization') && looksLikeRomanizationText(value)) {
    return 'romanization';
  }

  if (!usedFields.has('translation') && looksLikeTranslationText(primaryText, value)) {
    return 'translation';
  }

  return null;
};

const primaryLineScore = (line: LyricLine): number => {
  const text = normalizeLineText(line.text) ?? '';
  let score = 0;

  if (hasKana(text) || hasHangul(text)) {
    score += 8;
  } else if (hasHan(text)) {
    score += 6;
  } else if (hasEastAsianScript(text)) {
    score += 4;
  }

  if (looksLikeRomanizationText(text)) {
    score -= 10;
  }

  return score;
};

const selectPrimaryLineIndex = (group: LyricLine[]): number => {
  const englishPrimaryIndex = group.findIndex((line, index) => {
    const text = normalizeLineText(line.text) ?? '';
    return (
      looksLikeEnglishLyricText(text) &&
      group.some((candidate, candidateIndex) => {
        if (candidateIndex === index) {
          return false;
        }

        const candidateText = normalizeLineText(candidate.text) ?? '';
        return looksLikeTranslationText(text, candidateText);
      })
    );
  });
  if (englishPrimaryIndex >= 0) {
    return englishPrimaryIndex;
  }

  let primaryIndex = 0;
  let primaryScore = primaryLineScore(group[0]);

  for (let index = 1; index < group.length; index += 1) {
    const score = primaryLineScore(group[index]);
    if (score > primaryScore) {
      primaryIndex = index;
      primaryScore = score;
    }
  }

  return primaryIndex;
};

const collapseTimestampGroup = (group: LyricLine[]): LyricLine[] => {
  if (group.length <= 1) {
    return group;
  }

  const primaryIndex = selectPrimaryLineIndex(group);
  const primary = group[primaryIndex];
  const usedFields = new Set<'romanization' | 'translation'>();
  const collapsed: LyricLine = { ...primary };
  if (normalizeLineText(collapsed.romanization)) {
    usedFields.add('romanization');
  }
  if (normalizeLineText(collapsed.translation)) {
    usedFields.add('translation');
  }

  let changed = false;
  const pending: string[] = [];
  for (const [index, line] of group.entries()) {
    if (index === primaryIndex) {
      continue;
    }

    const alternateText = normalizeLineText(line.text);
    if (!alternateText || alternateText === collapsed.text) {
      continue;
    }

    const field = classifyAlternateLine(collapsed.text, alternateText, usedFields);
    if (field) {
      collapsed[field] = alternateText;
      usedFields.add(field);
      changed = true;
      continue;
    }

    pending.push(alternateText);
  }

  if (changed) {
    for (const alternateText of pending) {
      if (!usedFields.has('translation')) {
        collapsed.translation = alternateText;
        usedFields.add('translation');
        continue;
      }

      if (!usedFields.has('romanization')) {
        collapsed.romanization = alternateText;
        usedFields.add('romanization');
      }
    }

    return [collapsed];
  }

  return group;
};

export const normalizeSyncedLyricAlternates = (lines: LyricLine[]): LyricLine[] => {
  if (lines.length < 2) {
    return lines;
  }

  const normalized: LyricLine[] = [];
  let group: LyricLine[] = [];
  for (const line of lines) {
    if (line.timeMs < 0) {
      if (group.length > 0) {
        normalized.push(...collapseTimestampGroup(group));
        group = [];
      }
      normalized.push(line);
      continue;
    }

    if (group.length === 0 || group[0].timeMs === line.timeMs) {
      group.push(line);
      continue;
    }

    normalized.push(...collapseTimestampGroup(group));
    group = [line];
  }

  if (group.length > 0) {
    normalized.push(...collapseTimestampGroup(group));
  }

  return normalized;
};

export const parseSyncedLyrics = (lrcText: string): LyricLine[] => {
  const lines: LyricLine[] = [];

  for (const rawLine of lrcText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || metadataTagPattern.test(line)) {
      continue;
    }

    const neteaseYrcLine = parseNeteaseYrcLine(line);
    if (neteaseYrcLine) {
      lines.push(neteaseYrcLine);
      continue;
    }

    const timestamps = [...line.matchAll(timestampPattern)];
    if (!timestamps.length) {
      continue;
    }

    const leadingTimestamps = line.match(leadingTimestampsPattern)?.[0] ?? '';
    const leadingMatches = [...leadingTimestamps.matchAll(timestampPattern)];
    const hasOnlyLeadingTimestamps = timestamps.length === leadingMatches.length;

    if (looksLikeBracketEnhancedLine(line, timestamps, leadingMatches)) {
      const text = cleanBracketTimestampedLyricText(line.slice(leadingTimestamps.length));
      if (!text) {
        continue;
      }
      const words = parseBracketEnhancedWordTimings(line, timestamps, leadingMatches);

      for (const match of leadingMatches) {
        const timeMs = parseTimestamp(match);
        if (timeMs === null) {
          continue;
        }

        lines.push({ timeMs, ...attachWordTimings(splitInlineTranslation(text), words) });
      }

      continue;
    }

    if (hasOnlyLeadingTimestamps) {
      const content = line.slice(leadingTimestamps.length);
      const text = cleanLyricText(content);
      if (!text) {
        continue;
      }
      const words = parseAngleEnhancedWordTimings(content);

      for (const match of timestamps) {
        const timeMs = parseTimestamp(match);
        if (timeMs === null) {
          continue;
        }

        lines.push({ timeMs, ...attachWordTimings(splitInlineTranslation(text), words) });
      }

      continue;
    }

    for (let index = 0; index < timestamps.length; index += 1) {
      const match = timestamps[index];
      const timeMs = parseTimestamp(match);
      if (timeMs === null || match.index === undefined) {
        continue;
      }

      const textStart = match.index + match[0].length;
      const textEnd = timestamps[index + 1]?.index ?? line.length;
      const text = cleanLyricText(line.slice(textStart, textEnd));
      if (text) {
        const words = parseAngleEnhancedWordTimings(line.slice(textStart, textEnd));
        lines.push({ timeMs, ...attachWordTimings(splitInlineTranslation(text), words) });
      }
    }
  }

  return lines.sort((left, right) => left.timeMs - right.timeMs);
};

export const parsePlainLyrics = (plainText: string): LyricLine[] =>
  plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({
      timeMs: -1,
      ...splitInlineTranslation(text),
    }));

export const detectLyricsKind = ({
  instrumental,
  plainLyrics,
  syncedLyrics,
}: {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean | null;
}): LyricsKind => {
  if (instrumental) {
    return 'instrumental';
  }

  if (syncedLyrics && parseSyncedLyrics(syncedLyrics).length > 0) {
    return 'synced';
  }

  if (plainLyrics && parsePlainLyrics(plainLyrics).length > 0) {
    return 'plain';
  }

  return 'empty';
};

export const serializeLyricLines = (lines: LyricLine[]): string => JSON.stringify(lines);

const deserializeWordTimings = (value: unknown, lineText: string): LyricWordTiming[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const words = normalizeWordTimings(
    value
      .filter((word): word is Record<string, unknown> => Boolean(word && typeof word === 'object' && !Array.isArray(word)))
      .map((word) => ({
        text: typeof word.text === 'string' ? word.text : '',
        startMs: Number(word.startMs),
        endMs: word.endMs === null || word.endMs === undefined ? null : Number(word.endMs),
      })),
  );

  if (!words?.length) {
    return undefined;
  }

  return normalizedTextIdentity(words.map((word) => word.text).join('')) === normalizedTextIdentity(lineText)
    ? words
    : undefined;
};

export const deserializeLyricLines = (linesJson: string): LyricLine[] => {
  try {
    const parsed = JSON.parse(linesJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((line): line is Record<string, unknown> => line && typeof line === 'object' && !Array.isArray(line))
      .map((line) => {
        const text = typeof line.text === 'string' ? line.text : '';
        const words = deserializeWordTimings(line.words, text);
        return {
          timeMs: Number(line.timeMs),
          text,
          ...(words ? { words } : {}),
          ...(typeof line.translation === 'string' ? { translation: line.translation } : {}),
          ...(typeof line.romanization === 'string' ? { romanization: line.romanization } : {}),
          ...(typeof line.kana === 'string' ? { kana: line.kana } : {}),
        };
      })
      .filter((line) => Number.isFinite(line.timeMs) && line.text.trim().length > 0);
  } catch {
    return [];
  }
};
