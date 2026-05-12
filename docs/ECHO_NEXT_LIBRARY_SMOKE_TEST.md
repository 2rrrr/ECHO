# ECHO Next Library Smoke Test

Use this checklist with real local music folders after `npm run dev` opens the Electron app. Do not use browser-only preview for folder scanning.

## Test Sizes

- 100 tracks
- 1000 tracks
- 3000 tracks
- 10000 tracks, if available

## Import And Scan

1. Open Songs and click the folder-plus button.
2. Confirm it navigates to Import Folder.
3. Choose a folder and start scanning.
4. Watch scan status for discovered, parsed, skipped, cover, and error counts.
5. Open Folders and confirm the same folder panel is available for rescan/cancel/remove.
6. Open Settings > Library in dev mode and confirm Library Diagnostics updates without starting a scan.

Record:

- first scan duration
- CPU peak during scan
- memory usage during scan
- error count and representative errors
- Unknown Artist count
- embedded title/artist/album correctness
- embedded cover priority over folder/default covers
- album split mistakes

## Restart

1. Quit and reopen ECHO Next.
2. Confirm SongsPage reads from SQLite without reparsing files.
3. Confirm AlbumsPage loads the persisted album wall without renderer grouping.
4. Confirm album covers appear without scrolling-triggered extraction.

Record:

- cold startup time to first SongsPage data
- cold startup time to first AlbumsPage data
- whether any scan starts unexpectedly
- database size from diagnostics
- cover cache size from diagnostics

## Rescan

1. Rescan an unchanged folder.
2. Confirm skip rate approaches 100%.
3. Modify or add a small number of files and rescan.
4. Confirm only changed/new files are parsed.

Record:

- unchanged rescan duration
- skipped count
- parsed count
- cover count
- CPU and memory peaks

## List UX

1. Search Songs and Albums.
2. Sort Songs by title, artist, album, and recent.
3. Scroll Songs with 3000+ tracks and confirm virtual scrolling remains smooth.
4. Scroll Albums and confirm pagination appends more albums.

Record:

- getTracks first page query time from diagnostics
- getAlbums first page query time from diagnostics
- visible scroll jank or blank rows

## Playback

1. Click a TrackRow.
2. Double-click a TrackRow.
3. Confirm the real local file starts playback.
4. Confirm PlayerBar shows current file, track id, state, position/duration, codec, file sample rate, actual device sample rate, output mode, and sample-rate mismatch warning.
5. Test 44.1k, 48k, and 96k files.

Record:

- whether playback starts from SongsPage
- fileSampleRate for each file
- actualDeviceSampleRate for each file
- sampleRateMismatch state
- playback errors, if any

## Benchmark Baseline

Run:

```bash
npm run benchmark:library
```

Keep the 3000 and 10000 track output with the smoke-test notes. Phase 1.5 should enter Rust CoverWorker work only if real smoke data or the benchmark shows cover work is the bottleneck.
