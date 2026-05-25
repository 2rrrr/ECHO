// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlbumOnlineInfo, LibraryAlbum, LibraryArtist, LibraryTrack } from '../../../shared/types/library';
import { AlbumDetailView } from './AlbumDetailView';

const queueMock = {
  currentTrackId: null as string | null,
  playTrack: vi.fn().mockResolvedValue({}),
  replaceQueue: vi.fn(),
};

vi.mock('../../stores/PlaybackQueueProvider', () => ({
  usePlaybackQueue: () => queueMock,
}));

vi.mock('../../i18n/I18nProvider', () => {
  const strings: Record<string, string> = {
    'albumDetail.action.back': 'Albums',
    'albumDetail.aria.openArtist': 'Open artist {artist}',
    'albumDetail.online.match': 'MusicBrainz match',
    'albumDetail.information.artistProfile': 'Artist profile',
    'albumDetail.information.externalLinks': 'External links',
    'albumDetail.related.heading': 'My Library',
    'albumDetail.related.thisAlbum': 'This album',
    'albumDetail.tab.information': 'Information',
  };

  return {
    useI18n: () => ({
      t: (key: string, options?: Record<string, string | number>) =>
        Object.entries(options ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), strings[key] ?? key),
    }),
  };
});

vi.mock('./AlbumTrackList', async () => {
  const React = await import('react');

  return {
    AlbumTrackList: ({ onFirstTrackChange, onLoadedTracksChange }: {
      onFirstTrackChange?: (track: LibraryTrack | null, isLoading: boolean) => void;
      onLoadedTracksChange?: (tracks: LibraryTrack[], total: number, isLoading: boolean) => void;
    }) => {
      React.useEffect(() => {
        const loadedTrack = track();
        onFirstTrackChange?.(loadedTrack, false);
        onLoadedTracksChange?.([loadedTrack], 1, false);
      }, [onFirstTrackChange, onLoadedTracksChange]);

      return <section>Mock album tracks</section>;
    },
  };
});

const album = (): LibraryAlbum => ({
  id: 'album-1',
  albumKey: 'echo/unit',
  title: 'Mock Album',
  albumArtist: 'Echo Unit',
  year: 2026,
  trackCount: 1,
  duration: 180,
  coverId: null,
  coverThumb: null,
});

const track = (): LibraryTrack => ({
  id: 'track-1',
  path: 'D:\\Music\\track-1.flac',
  title: 'Mock Track',
  artist: 'Echo Unit',
  album: 'Mock Album',
  albumArtist: 'Echo Unit',
  trackNo: 1,
  discNo: 1,
  year: 2026,
  genre: null,
  duration: 180,
  codec: 'flac',
  sampleRate: 44100,
  bitDepth: 16,
  bitrate: 1000000,
  coverId: null,
  coverThumb: null,
  embeddedMetadataStatus: 'present',
  embeddedCoverStatus: 'missing',
  networkMetadataStatus: 'none',
  fieldSources: {},
});

const artist = (): LibraryArtist => ({
  id: 'artist-1',
  name: 'Echo Unit',
  sortName: 'Echo Unit',
  role: 'both',
  trackCount: 1,
  albumCount: 1,
  coverId: null,
  coverThumb: null,
  avatarUrl: null,
  avatarThumbUrl: null,
  avatarStatus: null,
});

const onlineInfo = (): AlbumOnlineInfo => ({
  albumId: 'album-1',
  status: 'ready',
  sources: [{ provider: 'wikipedia', label: 'en.wikipedia.org' }],
  match: null,
  credits: [
    {
      role: 'Composer',
      people: [{ name: 'Mock Composer', detail: 'music', trackTitle: null, source: 'work' }],
    },
  ],
  information: {
    title: 'Mock Album',
    description: 'Album',
    extract: 'Mock album overview.',
    url: 'https://example.test/album',
    language: 'en',
    thumbnailUrl: null,
    externalLinks: [{ label: 'example.test / album official', url: 'https://example.test/album-official' }],
  },
  artistInformation: {
    title: 'Echo Unit',
    description: 'Artist',
    extract: 'Echo Unit artist overview.',
    url: 'https://example.test/artist',
    language: 'en',
    thumbnailUrl: null,
    externalLinks: [{ label: 'example.test / artist official', url: 'https://example.test/artist-official' }],
  },
  fetchedAt: '2026-05-21T00:00:00.000Z',
  expiresAt: '2026-06-21T00:00:00.000Z',
  fromCache: false,
  errors: [],
});

const relatedAlbum = (): LibraryAlbum => ({
  ...album(),
  id: 'album-2',
  albumKey: 'echo/unit/sister',
  title: 'Sister Album',
  year: 2025,
  trackCount: 8,
  duration: 2200,
  coverId: 'cover-2',
  coverThumb: 'echo-cover://album/cover-2',
});

const installLibrary = (): {
  getAlbumOnlineInfo: ReturnType<typeof vi.fn>;
  getArtists: ReturnType<typeof vi.fn>;
  getArtistAlbums: ReturnType<typeof vi.fn>;
} => {
  const getAlbumOnlineInfo = vi.fn().mockResolvedValue(onlineInfo());
  const getArtists = vi.fn().mockResolvedValue({
    items: [artist()],
    page: 1,
    pageSize: 50,
    total: 1,
    hasMore: false,
  });
  const getArtistAlbums = vi.fn().mockResolvedValue({
    items: [album(), relatedAlbum()],
    page: 1,
    pageSize: 8,
    total: 2,
    hasMore: false,
  });
  window.echo = {
    app: {
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
    },
    library: {
      getAlbum: vi.fn().mockResolvedValue({ coverLarge: null }),
      getAlbumOnlineInfo,
      getArtists,
      getArtistAlbums,
      getLikedAlbumIds: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Window['echo'];
  return { getAlbumOnlineInfo, getArtists, getArtistAlbums };
};

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  queueMock.playTrack.mockReset();
  queueMock.playTrack.mockResolvedValue({});
  queueMock.replaceQueue.mockReset();
});

describe('AlbumDetailView', () => {
  it('returns from the album detail after Escape plays the back animation', async () => {
    vi.useFakeTimers();
    installLibrary();
    const onBack = vi.fn();

    render(<AlbumDetailView album={album()} onBack={onBack} />);

    expect(screen.getByText('Mock Album')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(180);
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('starts reading online album info when the detail opens and shows artist information', async () => {
    const { getAlbumOnlineInfo } = installLibrary();

    render(<AlbumDetailView album={album()} onBack={vi.fn()} />);

    await waitFor(() => expect(getAlbumOnlineInfo).toHaveBeenCalledWith('album-1', { force: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Information' }));

    expect(await screen.findByText('Artist profile - en.wikipedia.org')).toBeTruthy();
    expect(screen.getByText('Echo Unit artist overview.')).toBeTruthy();
  });

  it('opens information links through the system browser bridge', async () => {
    installLibrary();

    render(<AlbumDetailView album={album()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Information' }));
    fireEvent.click(await screen.findByRole('link', { name: /album official/i }));

    await waitFor(() => expect(window.echo?.app?.openExternalUrl).toHaveBeenCalledWith('https://example.test/album-official'));
  });

  it('opens the album artist detail from the hero artist name', async () => {
    const { getArtists } = installLibrary();
    const navigate = vi.fn();
    window.addEventListener('app:navigate:artist-detail', navigate);

    render(<AlbumDetailView album={album()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open artist Echo Unit' }));

    await waitFor(() => expect(getArtists).toHaveBeenCalledWith({ page: 1, pageSize: 50, search: 'Echo Unit', sort: 'default' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect((navigate.mock.calls[0]?.[0] as CustomEvent).detail.artist.id).toBe('artist-1');

    window.removeEventListener('app:navigate:artist-detail', navigate);
  });

  it('shows the album artist library shelf under the track list', async () => {
    const { getArtists, getArtistAlbums } = installLibrary();

    render(<AlbumDetailView album={album()} onBack={vi.fn()} />);

    expect(await screen.findByText('My Library')).toBeTruthy();
    expect(screen.getByText('Sister Album')).toBeTruthy();
    expect(screen.getByText('This album')).toBeTruthy();
    expect(getArtists).toHaveBeenCalledWith({ page: 1, pageSize: 50, search: 'Echo Unit', sort: 'default', sourceProvider: 'local' });
    expect(getArtistAlbums).toHaveBeenCalledWith('artist-1', { page: 1, pageSize: 8, sort: 'recent' });
  });
});
