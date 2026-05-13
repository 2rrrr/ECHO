import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { protocol } from 'electron';
import type { CoverVariant } from '../library/libraryTypes';
import { getAppSettings, getLyricsWallpaperDirectory } from '../app/appSettings';
import { getLibraryService } from '../library/LibraryService';
import { defaultCoverSvg } from '../library/workers/TsCoverExtractor';

const cacheControlHeader = 'public, max-age=31536000, immutable';
const wallpaperCacheControlHeader = 'no-store';

const isCoverVariant = (value: string): value is CoverVariant =>
  value === 'thumb' || value === 'album' || value === 'large' || value === 'original';

const contentTypeForPath = (filePath: string, fallback: string | null): string => {
  switch (extname(filePath).toLocaleLowerCase()) {
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return fallback ?? 'application/octet-stream';
  }
};

const isPathInsideDirectory = (directory: string, filePath: string): boolean => {
  const relativePath = relative(resolve(directory), resolve(filePath));
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
};

const defaultSvgResponse = (): Response =>
  new Response(defaultCoverSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
    },
  });

const missingCoverResponse = (): Response => new Response('', { status: 404 });

export const registerCoverProtocolScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'echo-cover',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: 'echo-video',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: 'echo-mv',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: 'echo-wallpaper',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
};

export const registerCoverProtocolHandler = (): void => {
  protocol.handle('echo-cover', async (request) => {
    try {
      const url = new URL(request.url);
      const variant = url.hostname;
      const coverId = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

      if (!isCoverVariant(variant) || !coverId) {
        return defaultSvgResponse();
      }

      const asset = getLibraryService().resolveCoverAsset(coverId, variant);

      if (!asset || !existsSync(asset.filePath)) {
        return variant === 'large' || variant === 'original' ? missingCoverResponse() : defaultSvgResponse();
      }

      return new Response(readFileSync(asset.filePath), {
        headers: {
          'Content-Type': contentTypeForPath(asset.filePath, asset.mimeType),
          'Cache-Control': cacheControlHeader,
        },
      });
    } catch {
      return defaultSvgResponse();
    }
  });
  protocol.handle('echo-wallpaper', async (request) => {
    try {
      const url = new URL(request.url);

      if (url.hostname !== 'lyrics' || url.pathname.replace(/^\/+/, '') !== 'custom') {
        return missingCoverResponse();
      }

      const wallpaperPath = getAppSettings().lyricsCustomWallpaperPath;
      if (!wallpaperPath || !isPathInsideDirectory(getLyricsWallpaperDirectory(), wallpaperPath) || !existsSync(wallpaperPath)) {
        return missingCoverResponse();
      }

      return new Response(readFileSync(wallpaperPath), {
        headers: {
          'Content-Type': contentTypeForPath(wallpaperPath, null),
          'Cache-Control': wallpaperCacheControlHeader,
        },
      });
    } catch {
      return missingCoverResponse();
    }
  });
};
