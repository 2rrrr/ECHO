import { open } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { parseFile } from 'music-metadata';
import type { IAudioMetadata } from 'music-metadata';
import { resolveCueTrack } from '../../audio/CueSheet';
import type { FieldSource, FieldSources, MetadataFields, MetadataResult } from '../libraryTypes';
import type { MetadataReader } from './MetadataReader';

const unknownArtist = 'Unknown Artist';
const unknownAlbum = '';
const waveInfoTagIds = new Set(['IART', 'INAM', 'IPRD', 'IGNR']);

type WaveInfoTags = Partial<Record<'IART' | 'INAM' | 'IPRD' | 'IGNR', string>>;

const cleanText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const cleanTextList = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return cleanText(value.find((item) => cleanText(item)));
  }

  return cleanText(value);
};

const stripTrailingNulls = (buffer: Buffer): Buffer => {
  let end = buffer.length;
  while (end > 0 && buffer[end - 1] === 0) {
    end -= 1;
  }

  return buffer.subarray(0, end);
};

const textQualityScore = (text: string): number => {
  let score = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === '\uFFFD') {
      score -= 40;
      continue;
    }

    if ((codePoint >= 0 && codePoint < 32 && ![9, 10, 13].includes(codePoint)) || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      score -= 25;
      continue;
    }

    if (
      (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
      (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7af)
    ) {
      score += 4;
      continue;
    }

    if (codePoint >= 0x20 && codePoint <= 0x7e) {
      score += 1;
      continue;
    }

    score += 0.5;
  }

  return score;
};

export const decodeWaveInfoText = (rawValue: Buffer): string | null => {
  const data = stripTrailingNulls(rawValue);
  if (data.length === 0) {
    return null;
  }

  const candidates = ['utf-8', 'gbk', 'shift_jis', 'big5', 'windows-1252'].flatMap((encoding) => {
    try {
      const text = new TextDecoder(encoding).decode(data).trim();
      return text.length > 0 ? [{ text, score: textQualityScore(text) }] : [];
    } catch {
      return [];
    }
  });

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.text ?? null;
};

const readWaveInfoTags = async (filePath: string): Promise<WaveInfoTags> => {
  if (extname(filePath).toLowerCase() !== '.wav') {
    return {};
  }

  const file = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const headerRead = await file.read(header, 0, header.length, 0);
    if (headerRead.bytesRead < header.length || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
      return {};
    }

    const fileSize = (await file.stat()).size;
    const tags: WaveInfoTags = {};
    let position = 12;

    while (position + 8 <= fileSize) {
      const chunkHeader = Buffer.alloc(8);
      const chunkHeaderRead = await file.read(chunkHeader, 0, chunkHeader.length, position);
      if (chunkHeaderRead.bytesRead < chunkHeader.length) {
        break;
      }

      const chunkId = chunkHeader.toString('ascii', 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      const chunkDataPosition = position + 8;

      if (chunkId === 'LIST' && chunkSize >= 4) {
        const listType = Buffer.alloc(4);
        const listTypeRead = await file.read(listType, 0, listType.length, chunkDataPosition);
        if (listTypeRead.bytesRead === listType.length && listType.toString('ascii') === 'INFO') {
          let infoPosition = chunkDataPosition + 4;
          const infoEnd = Math.min(chunkDataPosition + chunkSize, fileSize);

          while (infoPosition + 8 <= infoEnd) {
            const infoHeader = Buffer.alloc(8);
            const infoHeaderRead = await file.read(infoHeader, 0, infoHeader.length, infoPosition);
            if (infoHeaderRead.bytesRead < infoHeader.length) {
              break;
            }

            const infoId = infoHeader.toString('ascii', 0, 4);
            const infoSize = infoHeader.readUInt32LE(4);
            const infoDataPosition = infoPosition + 8;

            if (waveInfoTagIds.has(infoId) && infoDataPosition + infoSize <= fileSize) {
              const value = Buffer.alloc(infoSize);
              const valueRead = await file.read(value, 0, value.length, infoDataPosition);
              if (valueRead.bytesRead === value.length) {
                const decoded = decodeWaveInfoText(value);
                if (decoded) {
                  tags[infoId as keyof WaveInfoTags] = decoded;
                }
              }
            }

            infoPosition += 8 + infoSize + (infoSize % 2);
          }
        }
      }

      position += 8 + chunkSize + (chunkSize % 2);
    }

    return tags;
  } finally {
    await file.close();
  }
};

const guessFromFilename = (filePath: string): { artist: string | null; title: string } => {
  const name = basename(filePath, extname(filePath)).trim();
  const parts = name.split(' - ').map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: parts.slice(1).join(' - '),
    };
  }

  return {
    artist: null,
    title: name || 'Untitled',
  };
};

const folderAlbumFallback = (filePath: string): string | null => {
  const folderName = basename(dirname(filePath)).trim();
  return folderName.length > 0 ? folderName : null;
};

const codecFallback = (filePath: string, embeddedCodec: string | undefined): string | null => {
  const codec = cleanText(embeddedCodec);
  if (codec) {
    return codec;
  }

  const extension = extname(filePath).replace('.', '').toUpperCase();
  return extension.length > 0 ? extension : null;
};

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const positiveFloatOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const yearFromMetadata = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  return null;
};

const fallbackFields = (filePath: string): MetadataResult => {
  const filenameGuess = guessFromFilename(filePath);
  const folderAlbum = folderAlbumFallback(filePath);
  const artist = filenameGuess.artist ?? unknownArtist;
  const album = folderAlbum ?? unknownAlbum;
  const codec = codecFallback(filePath, undefined);

  return {
    fields: {
      title: filenameGuess.title,
      artist,
      album,
      albumArtist: artist,
      trackNo: null,
      discNo: null,
      year: null,
      genre: null,
      duration: 0,
      codec,
      sampleRate: null,
      bitDepth: null,
      bitrate: null,
      bpm: null,
    },
    fieldSources: {
      title: 'filename_fallback',
      artist: filenameGuess.artist ? 'filename_fallback' : 'unknown',
      album: folderAlbum ? 'folder_structure' : 'unknown',
      albumArtist: filenameGuess.artist ? 'artist_fallback' : 'unknown',
      trackNo: 'unknown',
      discNo: 'unknown',
      year: 'unknown',
      genre: 'unknown',
      duration: 'unknown',
      codec: codec ? 'filename_fallback' : 'unknown',
      sampleRate: 'unknown',
      bitDepth: 'unknown',
      bitrate: 'unknown',
      bpm: 'unknown',
    },
    embeddedMetadataStatus: 'missing',
    embeddedCoverStatus: 'missing',
    warnings: [],
    errors: [],
    status: 'fallback',
  };
};

export class TsMetadataReader implements MetadataReader {
  async read(filePath: string): Promise<MetadataResult> {
    try {
      const cueTrack = resolveCueTrack(filePath);
      const metadataPath = cueTrack?.audioPath ?? filePath;
      const metadata = await parseFile(metadataPath, {
        duration: true,
        skipCovers: false,
      });

      if (!cueTrack) {
        const waveInfoTags = await readWaveInfoTags(filePath).catch(() => ({}));
        return this.normalize(filePath, metadata, waveInfoTags);
      }

      const waveInfoTags = await readWaveInfoTags(metadataPath).catch(() => ({}));
      const normalized = this.normalize(metadataPath, metadata, waveInfoTags);
      const sourceDuration = normalized.fields.duration;
      const cueEndSeconds = cueTrack.endSeconds ?? (sourceDuration > 0 ? sourceDuration : null);
      const duration = cueEndSeconds !== null ? Math.max(0, cueEndSeconds - cueTrack.startSeconds) : 0;
      const title = cueTrack.title ?? normalized.fields.title;
      const artist = cueTrack.performer ?? cueTrack.albumArtist ?? normalized.fields.artist;
      const album = cueTrack.album ?? normalized.fields.album;
      const albumArtist = cueTrack.albumArtist ?? artist;

      return {
        ...normalized,
        fields: {
          ...normalized.fields,
          title,
          artist,
          album,
          albumArtist,
          trackNo: cueTrack.trackNumber,
          duration,
          codec: normalized.fields.codec ? `CUE/${normalized.fields.codec}` : 'CUE',
        },
        fieldSources: {
          ...normalized.fieldSources,
          title: cueTrack.title ? 'sidecar' : normalized.fieldSources.title,
          artist: cueTrack.performer || cueTrack.albumArtist ? 'sidecar' : normalized.fieldSources.artist,
          album: cueTrack.album ? 'sidecar' : normalized.fieldSources.album,
          albumArtist: cueTrack.albumArtist ? 'sidecar' : normalized.fieldSources.albumArtist,
          trackNo: 'sidecar',
          duration: 'sidecar',
          codec: normalized.fieldSources.codec ?? 'technical',
        },
        embeddedMetadataStatus: 'present',
        warnings: normalized.warnings,
        errors: normalized.errors,
        status: normalized.status,
      };
    } catch (error) {
      const cueTrack = resolveCueTrack(filePath);
      if (cueTrack) {
        return {
          fields: {
            title: cueTrack.title ?? `Track ${cueTrack.trackNumber}`,
            artist: cueTrack.performer ?? cueTrack.albumArtist ?? unknownArtist,
            album: cueTrack.album ?? folderAlbumFallback(cueTrack.cuePath) ?? unknownAlbum,
            albumArtist: cueTrack.albumArtist ?? cueTrack.performer ?? unknownArtist,
            trackNo: cueTrack.trackNumber,
            discNo: null,
            year: null,
            genre: null,
            duration: cueTrack.endSeconds !== null ? Math.max(0, cueTrack.endSeconds - cueTrack.startSeconds) : 0,
            codec: 'CUE',
            sampleRate: null,
            bitDepth: null,
            bitrate: null,
            bpm: null,
          },
          fieldSources: {
            title: cueTrack.title ? 'sidecar' : 'filename_fallback',
            artist: cueTrack.performer || cueTrack.albumArtist ? 'sidecar' : 'unknown',
            album: cueTrack.album ? 'sidecar' : 'folder_structure',
            albumArtist: cueTrack.albumArtist || cueTrack.performer ? 'sidecar' : 'unknown',
            trackNo: 'sidecar',
            discNo: 'unknown',
            year: 'unknown',
            genre: 'unknown',
            duration: cueTrack.endSeconds !== null ? 'sidecar' : 'unknown',
            codec: 'sidecar',
            sampleRate: 'unknown',
            bitDepth: 'unknown',
            bitrate: 'unknown',
            bpm: 'unknown',
          },
          embeddedMetadataStatus: 'present',
          embeddedCoverStatus: 'missing',
          warnings: [],
          errors: [error instanceof Error ? error.message : String(error)],
          status: 'fallback',
        };
      }

      const result = fallbackFields(filePath);
      return {
        ...result,
        status: 'error',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  normalize(filePath: string, metadata: IAudioMetadata, waveInfoTags: WaveInfoTags = {}): MetadataResult {
    const common = metadata.common;
    const format = metadata.format;
    const filenameGuess = guessFromFilename(filePath);
    const fieldSources: FieldSources = {};

    // Fixed priority: manual > embedded > sidecar/info > folder inference > network completion > filename fallback.
    // Phase v0.1 implements embedded tags, folder album fallback, and filename fallback; source names stay stable
    // so a future Rust/C++ reader can return the same shape without changing SQLite, IPC, or renderer code.
    const pickText = (field: string, embeddedValue: string | null, fallbackValue: string, fallbackSource: FieldSource) => {
      if (embeddedValue) {
        fieldSources[field] = 'embedded';
        return embeddedValue;
      }

      fieldSources[field] = fallbackSource;
      return fallbackValue;
    };

    const pickNumber = (field: string, value: number | null): number | null => {
      fieldSources[field] = value !== null ? 'embedded' : 'unknown';
      return value;
    };

    const embeddedTitle = cleanText(waveInfoTags.INAM) ?? cleanText(common.title);
    const embeddedArtist = cleanText(waveInfoTags.IART) ?? cleanTextList(common.artist ?? common.artists?.[0]);
    const embeddedAlbum = cleanText(waveInfoTags.IPRD) ?? cleanText(common.album);
    const embeddedAlbumArtist = cleanTextList(common.albumartist);
    const embeddedGenre = cleanText(waveInfoTags.IGNR) ?? cleanTextList(common.genre);
    const folderAlbum = folderAlbumFallback(filePath);

    const title = pickText('title', embeddedTitle, filenameGuess.title, 'filename_fallback');
    const artist = pickText('artist', embeddedArtist, filenameGuess.artist ?? unknownArtist, filenameGuess.artist ? 'filename_fallback' : 'unknown');
    const album = pickText('album', embeddedAlbum, folderAlbum ?? unknownAlbum, folderAlbum ? 'folder_structure' : 'unknown');
    const albumArtist = pickText('albumArtist', embeddedAlbumArtist, artist, 'artist_fallback');
    const trackNo = pickNumber('trackNo', numberOrNull(common.track?.no));
    const discNo = pickNumber('discNo', numberOrNull(common.disk?.no));
    const year = pickNumber('year', yearFromMetadata(common.year ?? common.date));
    const genre = embeddedGenre;
    fieldSources.genre = genre ? 'embedded' : 'unknown';
    const duration = Math.max(0, Number(format.duration ?? 0));
    fieldSources.duration = duration > 0 ? 'technical' : 'unknown';
    const codec = codecFallback(filePath, format.codec);
    fieldSources.codec = codec ? (format.codec ? 'technical' : 'filename_fallback') : 'unknown';
    const sampleRate = typeof format.sampleRate === 'number' ? format.sampleRate : null;
    fieldSources.sampleRate = sampleRate ? 'technical' : 'unknown';
    const bitDepth = typeof format.bitsPerSample === 'number' ? format.bitsPerSample : null;
    fieldSources.bitDepth = bitDepth ? 'technical' : 'unknown';
    const bitrate = typeof format.bitrate === 'number' ? Math.round(format.bitrate) : null;
    fieldSources.bitrate = bitrate ? 'technical' : 'unknown';
    const bpm = positiveFloatOrNull(common.bpm);
    fieldSources.bpm = bpm ? 'embedded' : 'unknown';
    const picture = common.picture?.[0];
    const hasEmbeddedMetadata = [
      embeddedTitle,
      embeddedArtist,
      embeddedAlbum,
      embeddedAlbumArtist,
      embeddedGenre,
      trackNo,
      discNo,
      year,
    ].some((value) => value !== null && value !== undefined && value !== '');

    const fields: MetadataFields = {
      title,
      artist,
      album,
      albumArtist,
      trackNo,
      discNo,
      year,
      genre,
      duration,
      codec,
      sampleRate,
      bitDepth,
      bitrate,
      bpm,
    };

    return {
      fields,
      fieldSources,
      embeddedCover: picture
        ? {
            data: picture.data,
            mimeType: cleanText(picture.format),
          }
        : undefined,
      embeddedMetadataStatus: hasEmbeddedMetadata ? 'present' : 'missing',
      embeddedCoverStatus: picture ? 'present' : 'missing',
      warnings: [],
      errors: [],
      status: 'ok',
    };
  }
}
