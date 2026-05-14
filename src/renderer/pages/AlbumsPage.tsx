import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown, Disc3, ListFilter, RefreshCw, Search } from 'lucide-react';
import type { LibraryAlbum, LibrarySort } from '../../shared/types/library';
import { AlbumDetailView } from '../components/album/AlbumDetailView';
import { InfiniteScrollSentinel, readPageScrollTop, writePageScrollTop } from '../components/ui/InfiniteScrollSentinel';
import { MediaWallScrollSpacer, useMediaWallScrollSpacer } from '../components/ui/MediaWallScrollSpacer';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/locales';

const pageSize = 60;
const albumSortOptions: Array<{ value: LibrarySort; labelKey: TranslationKey }> = [
  { value: 'default', labelKey: 'library.sort.default' },
  { value: 'titleAsc', labelKey: 'library.albums.sort.titleAsc' },
  { value: 'titleDesc', labelKey: 'library.albums.sort.titleDesc' },
  { value: 'artist', labelKey: 'library.albums.sort.artist' },
  { value: 'createdAsc', labelKey: 'library.sort.createdAsc' },
  { value: 'createdDesc', labelKey: 'library.sort.createdDesc' },
  { value: 'durationAsc', labelKey: 'library.sort.durationAsc' },
  { value: 'durationDesc', labelKey: 'library.sort.durationDesc' },
  { value: 'recent', labelKey: 'library.sort.recent' },
  { value: 'random', labelKey: 'library.sort.random' },
];

export const AlbumsPage = (): JSX.Element => {
  const { t } = useI18n();
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('default');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<LibraryAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedCoverUrls, setFailedCoverUrls] = useState<Record<string, string>>({});
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const pageScrollTopRef = useRef(0);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const shouldRestorePageScrollRef = useRef(false);
  const requestIdRef = useRef(0);
  const isLoadingRef = useRef(false);
  const { wallRef: albumWallRef, spacerHeight } = useMediaWallScrollSpacer<HTMLElement>({
    itemCount: albums.length,
    totalCount: total,
    minColumnWidth: 164,
    columnGap: 14,
    rowGap: 14,
    estimatedItemHeight: 214,
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

  const loadAlbums = useCallback(
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

        if (!library) {
          setAlbums([]);
          setPage(1);
          setTotal(0);
          setHasMore(false);
          setError(t('library.albums.error.desktopBridge'));
          return;
        }

        const result = await library.getAlbums({
          page: nextPage,
          pageSize,
          search,
          sort,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setAlbums((current) => (mode === 'append' ? [...current, ...result.items] : result.items));
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
        if (mode === 'replace') {
          setFailedCoverUrls({});
        }
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
    void loadAlbums(1, 'replace');
  }, [loadAlbums]);

  useEffect(() => {
    const handleLibraryChanged = (): void => {
      writePageScrollTop(pageRootRef.current, 0);
      void loadAlbums(1, 'replace');
    };

    window.addEventListener('library:changed', handleLibraryChanged);
    return () => window.removeEventListener('library:changed', handleLibraryChanged);
  }, [loadAlbums]);

  useLayoutEffect(() => {
    writePageScrollTop(pageRootRef.current, 0);
  }, [search, sort]);

  useLayoutEffect(() => {
    if (selectedAlbum || !shouldRestorePageScrollRef.current) {
      return;
    }

    writePageScrollTop(pageRootRef.current, pageScrollTopRef.current);
    shouldRestorePageScrollRef.current = false;
  }, [selectedAlbum]);

  const openAlbumDetail = useCallback((album: LibraryAlbum): void => {
    pageScrollTopRef.current = readPageScrollTop(pageRootRef.current);
    shouldRestorePageScrollRef.current = true;
    setSelectedAlbum(album);
  }, []);

  const handleLoadMoreAlbums = useCallback((): void => {
    if (isLoadingRef.current || !hasMore) {
      return;
    }

    void loadAlbums(page + 1, 'append');
  }, [hasMore, loadAlbums, page]);

  const handleRefresh = useCallback((): void => {
    writePageScrollTop(pageRootRef.current, 0);
    void loadAlbums(1, 'replace');
  }, [loadAlbums]);

  const handleAlbumKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, album: LibraryAlbum): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAlbumDetail(album);
    }
  }, [openAlbumDetail]);

  const handleAlbumCoverError = useCallback((album: LibraryAlbum): void => {
    if (!album.coverThumb) {
      return;
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('Failed to load album cover', {
        url: album.coverThumb,
        albumId: album.id,
      });
    }

    setFailedCoverUrls((current) =>
      current[album.id] === album.coverThumb
        ? current
        : {
            ...current,
            [album.id]: album.coverThumb!,
          },
    );
  }, []);

  if (selectedAlbum) {
    return <AlbumDetailView album={selectedAlbum} onBack={() => setSelectedAlbum(null)} />;
  }

  return (
    <div ref={pageRootRef} className="albums-page">
      <header className="songs-header">
        <div className="songs-title-group">
          <h1>{t('library.albums.title')}</h1>
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
            placeholder={t('library.albums.searchPlaceholder')}
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
            <span className="sort-button-label">{t(albumSortOptions.find((option) => option.value === sort)?.labelKey ?? 'library.sort.default')}</span>
            <ChevronDown className="sort-button-chevron" size={15} aria-hidden="true" />
          </button>
          {isSortOpen ? (
            <div className="sort-menu" role="listbox" aria-label={t('library.albums.sort.aria')}>
              {albumSortOptions.map((option) => (
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

      <section ref={albumWallRef} className="album-wall" aria-label={t('library.albums.listAria')}>
        {albums.map((album) => {
          const shouldShowCover = Boolean(album.coverThumb && failedCoverUrls[album.id] !== album.coverThumb);

          return (
            <article
              className="album-card"
              key={album.id}
              role="button"
              tabIndex={0}
              onClick={() => openAlbumDetail(album)}
              onKeyDown={(event) => handleAlbumKeyDown(event, album)}
            >
              <div className="album-cover" data-empty={!shouldShowCover} aria-hidden="true">
                {shouldShowCover ? (
                  <img
                    alt=""
                    decoding="async"
                    draggable={false}
                    height={320}
                    loading="lazy"
                    src={album.coverThumb!}
                    width={320}
                    onError={() => handleAlbumCoverError(album)}
                  />
                ) : (
                  <Disc3 size={24} />
                )}
              </div>
              <div className="album-copy">
                <strong>{album.title}</strong>
                <span>{album.albumArtist}</span>
                <small>{t('library.albums.card.tracks', { count: album.trackCount })}</small>
              </div>
            </article>
          );
        })}
        {/* TODO: If 3000/10000 album smoke tests still show scroll jank, replace this paged wall with @tanstack/react-virtual grid virtualization. */}
      </section>
      <InfiniteScrollSentinel canLoadMore={hasMore} isLoading={isLoading} onLoadMore={handleLoadMoreAlbums} />

      {error || isLoading ? (
        <div className="list-footer">
          <span>{error ?? t('library.albums.loading')}</span>
        </div>
      ) : null}
      <MediaWallScrollSpacer height={spacerHeight} />
    </div>
  );
};
