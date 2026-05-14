import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown, ListFilter, Play, RefreshCw, Search } from 'lucide-react';
import type { LibraryArtist, LibrarySort } from '../../shared/types/library';
import { ArtistDetailView } from '../components/artist/ArtistDetailView';
import { artistMark } from '../components/artist/artistVisual';
import { InfiniteScrollSentinel, readPageScrollTop, writePageScrollTop } from '../components/ui/InfiniteScrollSentinel';
import { MediaWallScrollSpacer, useMediaWallScrollSpacer } from '../components/ui/MediaWallScrollSpacer';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/locales';

const pageSize = 96;
const artistSortOptions: Array<{ value: LibrarySort; labelKey: TranslationKey }> = [
  { value: 'default', labelKey: 'library.sort.default' },
  { value: 'titleAsc', labelKey: 'library.artists.sort.nameAsc' },
  { value: 'titleDesc', labelKey: 'library.artists.sort.nameDesc' },
  { value: 'frequent', labelKey: 'library.artists.sort.frequent' },
  { value: 'createdAsc', labelKey: 'library.sort.createdAsc' },
  { value: 'createdDesc', labelKey: 'library.sort.createdDesc' },
  { value: 'random', labelKey: 'library.sort.random' },
];

const artistMeta = (artist: LibraryArtist, t: (key: TranslationKey, options?: Record<string, string | number>) => string): string => {
  const parts: string[] = [];

  if (artist.trackCount > 0) {
    parts.push(t('library.artists.meta.tracks', { count: artist.trackCount }));
  }

  if (artist.albumCount > 0) {
    parts.push(t('library.artists.meta.albums', { count: artist.albumCount }));
  }

  return parts.join(' / ') || t('library.artists.meta.noTracks');
};

export const ArtistsPage = (): JSX.Element => {
  const { t } = useI18n();
  const [artists, setArtists] = useState<LibraryArtist[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('default');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<LibraryArtist | null>(null);
  const [artistWallAlbumArtwork, setArtistWallAlbumArtwork] = useState(false);
  const [failedCoverUrls, setFailedCoverUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const pageScrollTopRef = useRef(0);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldRestorePageScrollRef = useRef(false);
  const requestIdRef = useRef(0);
  const isLoadingRef = useRef(false);
  const { wallRef: artistWallRef, spacerHeight } = useMediaWallScrollSpacer<HTMLElement>({
    itemCount: artists.length,
    totalCount: total,
    minColumnWidth: 128,
    columnGap: 22,
    rowGap: 30,
    estimatedItemHeight: 174,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isSortOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isSortOpen]);

  const loadArtists = useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      if (mode === 'append' && isLoadingRef.current) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const library = window.echo?.library;

        if (!library?.getArtists) {
          setArtists([]);
          setPage(1);
          setTotal(0);
          setHasMore(false);
          setError(t('library.artists.error.desktopBridge'));
          return;
        }

        const result = await library.getArtists({
          page: nextPage,
          pageSize,
          search,
          sort,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setArtists((current) => (mode === 'append' ? [...current, ...result.items] : result.items));
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch (loadError) {
        if (requestIdRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [search, sort, t],
  );

  useEffect(() => {
    void loadArtists(1, 'replace');
  }, [loadArtists]);

  useEffect(() => {
    const handleLibraryChanged = (): void => {
      writePageScrollTop(pageRootRef.current, 0);
      void loadArtists(1, 'replace');
    };

    window.addEventListener('library:changed', handleLibraryChanged);
    return () => window.removeEventListener('library:changed', handleLibraryChanged);
  }, [loadArtists]);

  useLayoutEffect(() => {
    writePageScrollTop(pageRootRef.current, 0);
  }, [search, sort]);

  useLayoutEffect(() => {
    if (selectedArtist || !shouldRestorePageScrollRef.current) {
      return;
    }

    writePageScrollTop(pageRootRef.current, pageScrollTopRef.current);
    shouldRestorePageScrollRef.current = false;
  }, [selectedArtist]);

  useEffect(() => {
    const loadSettings = (): void => {
      const app = window.echo?.app;

      if (!app?.getSettings) {
        setArtistWallAlbumArtwork(false);
        return;
      }

      void app
        .getSettings()
        .then((settings) => setArtistWallAlbumArtwork(settings.artistWallAlbumArtwork === true))
        .catch(() => setArtistWallAlbumArtwork(false));
    };

    loadSettings();
    window.addEventListener('settings:changed', loadSettings);
    return () => window.removeEventListener('settings:changed', loadSettings);
  }, []);

  const handleLoadMoreArtists = useCallback((): void => {
    if (isLoadingRef.current || !hasMore) {
      return;
    }

    void loadArtists(page + 1, 'append');
  }, [hasMore, loadArtists, page]);

  const handleRefresh = useCallback((): void => {
    writePageScrollTop(pageRootRef.current, 0);
    void loadArtists(1, 'replace');
  }, [loadArtists]);

  const handleArtistCoverError = useCallback((artist: LibraryArtist): void => {
    if (!artist.coverThumb) {
      return;
    }

    setFailedCoverUrls((current) =>
      current[artist.id] === artist.coverThumb
        ? current
        : {
            ...current,
            [artist.id]: artist.coverThumb!,
          },
    );
  }, []);

  const openArtistDetail = useCallback((artist: LibraryArtist): void => {
    pageScrollTopRef.current = readPageScrollTop(pageRootRef.current);
    shouldRestorePageScrollRef.current = true;
    setSelectedArtist(artist);
  }, []);

  const handleArtistKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, artist: LibraryArtist): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openArtistDetail(artist);
    }
  }, [openArtistDetail]);

  if (selectedArtist) {
    return <ArtistDetailView artist={selectedArtist} onBack={() => setSelectedArtist(null)} />;
  }

  return (
    <div ref={pageRootRef} className="artists-page">
      <header className="songs-header">
        <div className="songs-title-group">
          <h1>{t('library.artists.title')}</h1>
          <span>{t('library.count.total', { count: total })}</span>
        </div>
        <button className="tool-button album-refresh" type="button" aria-label={t('library.action.refresh')} title={t('library.action.refresh')} onClick={handleRefresh}>
          <RefreshCw size={17} />
        </button>
      </header>

      <div className="songs-control-row">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('library.artists.searchPlaceholder')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className="sort-select" ref={sortMenuRef}>
          <button
            className="sort-button"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isSortOpen}
            onClick={() => setIsSortOpen((current) => !current)}
          >
            <ListFilter className="sort-button-icon" size={16} aria-hidden="true" />
            <span className="sort-button-label">{t(artistSortOptions.find((option) => option.value === sort)?.labelKey ?? 'library.sort.default')}</span>
            <ChevronDown className="sort-button-chevron" size={15} aria-hidden="true" />
          </button>
          {isSortOpen ? (
            <div className="sort-menu" role="listbox" aria-label={t('library.artists.sort.aria')}>
              {artistSortOptions.map((option) => (
                <button
                  key={option.value}
                  className="sort-option"
                  type="button"
                  role="option"
                  aria-selected={sort === option.value}
                  onClick={() => {
                    setSort(option.value);
                    setIsSortOpen(false);
                  }}
                >
                  <span>{t(option.labelKey)}</span>
                  {sort === option.value ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <section ref={artistWallRef} className="artist-wall" aria-label={t('library.artists.listAria')}>
        {artists.map((artist) => {
          const shouldShowCover = Boolean(
            artistWallAlbumArtwork && artist.coverThumb && failedCoverUrls[artist.id] !== artist.coverThumb,
          );

          return (
            <article
              className="artist-card"
              data-cover={shouldShowCover}
              key={artist.id}
              role="button"
              tabIndex={0}
              onClick={() => openArtistDetail(artist)}
              onKeyDown={(event) => handleArtistKeyDown(event, artist)}
            >
              <div className="artist-avatar" data-cover={shouldShowCover} aria-hidden="true">
                {shouldShowCover ? (
                  <img
                    alt=""
                    decoding="async"
                    draggable={false}
                    height={320}
                    loading="lazy"
                    src={artist.coverThumb!}
                    width={320}
                    onError={() => handleArtistCoverError(artist)}
                  />
                ) : (
                  <span>{artistMark(artist.name)}</span>
                )}
              </div>
              <div className="artist-copy">
                <strong>{artist.name}</strong>
                <small>{artistMeta(artist, t)}</small>
              </div>
              <span className="artist-card-action" aria-hidden="true">
                <Play size={14} fill="currentColor" />
              </span>
            </article>
          );
        })}
      </section>
      <InfiniteScrollSentinel canLoadMore={hasMore} isLoading={isLoading} onLoadMore={handleLoadMoreArtists} />

      {error || isLoading ? (
        <div className="list-footer">
          <span>{error ?? t('library.artists.loading')}</span>
        </div>
      ) : null}
      <MediaWallScrollSpacer height={spacerHeight} />
    </div>
  );
};
