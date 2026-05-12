import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Disc3, RefreshCw, Search } from 'lucide-react';
import type { LibraryAlbum, LibrarySort } from '../../shared/types/library';

const pageSize = 60;

export const AlbumsPage = (): JSX.Element => {
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('title');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedCoverUrls, setFailedCoverUrls] = useState<Record<string, string>>({});
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAlbums = useCallback(
    async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const library = window.echo?.library;

        if (!library) {
          setAlbums([]);
          setTotal(0);
          setError('Desktop bridge unavailable. Open ECHO Next in Electron to read albums.');
          return;
        }

        const loadedAlbums: LibraryAlbum[] = [];
        let nextPage = 1;
        let nextTotal = 0;
        let hasMorePages = true;

        while (hasMorePages) {
          const result = await library.getAlbums({
            page: nextPage,
            pageSize,
            search,
            sort,
          });

          if (requestIdRef.current !== requestId) {
            return;
          }

          loadedAlbums.push(...result.items);
          nextTotal = result.total;
          hasMorePages = result.hasMore;
          nextPage = result.page + 1;
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setAlbums(loadedAlbums);
        setTotal(nextTotal);
      } catch (loadError) {
        if (requestIdRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [search, sort],
  );

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    const handleLibraryChanged = (): void => {
      void loadAlbums();
    };

    window.addEventListener('library:changed', handleLibraryChanged);
    return () => window.removeEventListener('library:changed', handleLibraryChanged);
  }, [loadAlbums]);

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

  return (
    <div className="albums-page">
      <header className="songs-header">
        <div className="songs-title-group">
          <h1>Albums</h1>
          <span>{total} total</span>
        </div>
        <button className="tool-button album-refresh" type="button" aria-label="Refresh" title="Refresh" onClick={() => loadAlbums()}>
          <RefreshCw size={17} />
        </button>
      </header>

      <div className="songs-control-row">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search albums / artists"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <label className="sort-button sort-select">
          <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="recent">Recent</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>

      <section className="album-wall" aria-label="Album list">
        {albums.map((album) => {
          const shouldShowCover = Boolean(album.coverThumb && failedCoverUrls[album.id] !== album.coverThumb);

          return (
            <article className="album-card" key={album.id}>
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
                <small>{album.trackCount} tracks</small>
              </div>
            </article>
          );
        })}
      </section>

      {error || isLoading ? (
        <div className="list-footer">
          <span>{error ?? 'Loading albums...'}</span>
        </div>
      ) : null}
    </div>
  );
};
