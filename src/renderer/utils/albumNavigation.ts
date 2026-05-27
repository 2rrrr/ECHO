import type { LibraryAlbum, LibraryTrack } from '../../shared/types/library';

export const albumDetailNavigationEvent = 'app:navigate:album-detail';

export type DetailReturnTarget = 'history' | 'home' | 'songs';

export type AlbumDetailNavigationRequest = {
  album: LibraryAlbum;
  returnTo?: DetailReturnTarget;
};

let pendingAlbumDetail: AlbumDetailNavigationRequest | null = null;

export const requestAlbumDetailNavigation = (album: LibraryAlbum, options: { returnTo?: DetailReturnTarget } = {}): void => {
  const request = { album, returnTo: options.returnTo };
  pendingAlbumDetail = request;
  window.dispatchEvent(new CustomEvent<AlbumDetailNavigationRequest>(albumDetailNavigationEvent, { detail: request }));
};

export const consumePendingAlbumDetailNavigation = (): AlbumDetailNavigationRequest | null => {
  const request = pendingAlbumDetail;
  pendingAlbumDetail = null;
  return request;
};

const normalizeAlbumText = (value: string | null | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const isSameAlbumCandidate = (candidate: LibraryAlbum, album: LibraryAlbum): boolean => {
  if (album.mediaType && candidate.mediaType && candidate.mediaType !== album.mediaType) {
    return false;
  }

  if (album.sourceId && candidate.sourceId && candidate.sourceId !== album.sourceId) {
    return false;
  }

  const sameTitle = normalizeAlbumText(candidate.title) === normalizeAlbumText(album.title);
  const sameArtist = normalizeAlbumText(candidate.albumArtist) === normalizeAlbumText(album.albumArtist);
  const sameYear = candidate.year === album.year || !candidate.year || !album.year;

  return sameTitle && sameArtist && sameYear;
};

export const resolveAlbumDetailNavigationTarget = async (album: LibraryAlbum): Promise<LibraryAlbum> => {
  const library = window.echo?.library;

  if (!library) {
    return album;
  }

  try {
    const currentAlbum = await library.getAlbum?.(album.id);
    if (currentAlbum) {
      return currentAlbum;
    }
  } catch {
    // Fall through to a bounded search so stale cached album ids can recover.
  }

  if (!library.getAlbums) {
    return album;
  }

  const search = album.title.trim() || album.albumArtist.trim();
  if (!search) {
    return album;
  }

  try {
    const result = await library.getAlbums({ page: 1, pageSize: 50, search });
    const exactKeyMatch = result.items.find((candidate) => candidate.albumKey === album.albumKey);
    if (exactKeyMatch) {
      return exactKeyMatch;
    }

    const exactIdentityMatch = result.items.find((candidate) => isSameAlbumCandidate(candidate, album));
    if (exactIdentityMatch) {
      return exactIdentityMatch;
    }
  } catch {
    return album;
  }

  return album;
};

export const openAlbumDetail = async (album: LibraryAlbum, options: { returnTo?: DetailReturnTarget } = {}): Promise<LibraryAlbum> => {
  const resolvedAlbum = await resolveAlbumDetailNavigationTarget(album);
  requestAlbumDetailNavigation(resolvedAlbum, options);
  return resolvedAlbum;
};

export const openAlbumDetailForTrack = async (track: LibraryTrack, options: { returnTo?: DetailReturnTarget } = {}): Promise<LibraryAlbum | null> => {
  const library = window.echo?.library;

  if (!library?.getAlbumForTrack) {
    throw new Error('Desktop bridge unavailable. Open ECHO Next in Electron to locate this album.');
  }

  const album = await library.getAlbumForTrack(track.id);

  if (album) {
    requestAlbumDetailNavigation(album, options);
  }

  return album;
};
