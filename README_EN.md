<p align="center">
  <img src="./build-resources/icons/logo.png" alt="ECHO NEXT" width="520" />
</p>

<h1 align="center">ECHO NEXT</h1>

<p align="center">
  <strong>A source-available desktop music player for local libraries, HiFi output, and long-term maintainability.</strong>
</p>

<p align="center">
  <a href="./README.md">Chinese README</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://echonagi.com/">Official Site</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://github.com/moekotori/echo/releases/latest">Latest Release</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://qm.qq.com/q/OdpngxJU86">QQ Group</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://discord.gg/g7v4WMRq3K">Discord</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="#quick-start">Quick Start</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/USER_GUIDE.md">User Guide</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/ECHO_NEXT_PLUGINS.md">Plugin Authoring</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/ECHO_NEXT_LINUX_BUILD.md">Linux Build Guide</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="#development-and-builds">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/moekotori/echo?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/github/stars/moekotori/echo?style=flat-square&logo=github" alt="GitHub stars" />
  <img src="https://img.shields.io/github/downloads/moekotori/echo/total?style=flat-square&logo=github" alt="GitHub downloads" />
  <img src="https://img.shields.io/badge/Electron-42.x-47848f?style=flat-square" alt="Electron 42" />
  <img src="https://img.shields.io/badge/React-18.2-61dafb?style=flat-square" alt="React 18.2" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
</p>

<p align="center">
  <img src="./docs/img.png" alt="ECHO NEXT interface preview" width="100%" />
</p>

---

## What ECHO NEXT Is

ECHO NEXT is the next-generation desktop music player in the ECHO family. It is not a simple reskin of the previous app. It rebuilds the project around local library management, stable playback, native audio output, lyrics, MV, remote sources, plugins, and clearer Electron architecture boundaries.

The priorities are intentionally strict: reliable local playback, stable audio behavior, responsive large-library browsing, user data safety, and network features that extend the player without turning it into a thin online-platform shell.

> [!IMPORTANT]
> ECHO NEXT is still a local music player at its core. When reporting issues, please include reproducible steps, system information, app version, screenshots, logs, and the exact path you took in the app. Requests to bypass memberships, copyright restrictions, platform restrictions, or DRM are not accepted.

## Who It Is For

| If you want to | ECHO NEXT focuses on |
| --- | --- |
| Manage your own music files | Folder scanning, SQLite library storage, metadata reading, cover caching, album grouping |
| Tune serious output on Windows | System output, WASAPI, ASIO, EQ, sample-rate status, bit-perfect hints |
| Keep a large library usable | Virtualized lists, paged loading, cover caches, and bounded background work |
| Control lyrics, MV, covers, and metadata | Local-first data, manual selection, source priorities, and local cache boundaries |
| Extend the app without breaking playback | Plugins, remote libraries, downloaders, streaming helpers, and network metadata behind controlled boundaries |

## Core Features

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Local library</strong><br />
      Folder imports, songs, albums, artists, inbox, liked tracks, history, playlists, duplicate filtering, and tag editing.
    </td>
    <td width="33%" valign="top">
      <strong>Stable playback</strong><br />
      Playback queue, bottom player, system media controls, output-device state, playback diagnostics, error reporting, and recovery boundaries.
    </td>
    <td width="33%" valign="top">
      <strong>HiFi output</strong><br />
      WASAPI Shared, WASAPI Exclusive, ASIO, EQ, preamp, ReplayGain, sample-rate status, and bit-perfect hints.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>Lyrics and MV</strong><br />
      Local lyrics, online candidates, translation, romanization, Japanese kana enhancement, lyric offset, MV matching, quality selection, and external-playback boundaries.
    </td>
    <td width="33%" valign="top">
      <strong>Network extensions</strong><br />
      WebDAV, Jellyfin, Emby, SMB, SSHFS, Subsonic, streaming search, downloaders, network proxy settings, and remote background tasks.
    </td>
    <td width="33%" valign="top">
      <strong>Maintenance and diagnostics</strong><br />
      Plugin permissions, logs, crash recovery, library health, cache migration, settings backup, and dangerous-operation confirmation.
    </td>
  </tr>
</table>

## Quick Start

### Download a release

Most users should start from [GitHub Releases](https://github.com/moekotori/echo/releases/latest). Windows users usually want the installer or portable build. Linux users can use the AppImage or deb package when those artifacts are available for a release.

On first launch, import a small folder first and confirm that scanning, covers, playback, and lyrics work as expected. Import your full library after that initial check.

### Recommended first run

| Step | Action |
| --- | --- |
| 1 | Import a small local music folder |
| 2 | Check `Songs`, `Albums`, and `Inbox` for tracks, covers, and album grouping |
| 3 | Try playback, liking, queue actions, playlists, and context menus |
| 4 | Adjust lyrics, MV, EQ, output device, and appearance |
| 5 | Enable remote sources, streaming, downloads, or plugins only when needed |

The detailed user guide is currently in Chinese: [docs/USER_GUIDE.md](./docs/USER_GUIDE.md).

## Page Guide

| Page | Purpose |
| --- | --- |
| `Songs` | Full-library browsing, search, sort, multi-select, tag editing, duplicate filtering |
| `Albums` | Album wall, album details, whole-album playback, cover and tag cleanup |
| `Artists` | Browse tracks and albums by artist |
| `Folders` | Manage local import folders and scan state |
| `Inbox` | Review newly scanned tracks |
| `Queue` | Manage the temporary playback order |
| `Liked` | Keep quick access to favorite tracks |
| `History` | Recover recently played music |
| `Playlists` | Manage long-lived playlists |
| `Lyrics` | Immersive lyrics and playback view |
| `Streaming` | Search, preview, and discover online candidates |
| `Downloads` | URL downloads, search downloads, and library import |
| `Cloud / Remote` | Remote sources and remote library indexing |
| `Connect` | Local-network playback features such as DLNA and AirPlay |
| `Plugins` | Local plugins, permissions, logs, import, and export |
| `Settings` | Playback, lyrics, MV, EQ, appearance, library, integrations, diagnostics, and dangerous operations |

## ECHO NEXT vs ECHO

ECHO is the earlier full-featured player. It focuses on putting local playback, lyrics, MV, downloads, plugins, casting, and shared-listening features into one desktop app.

ECHO NEXT is a deeper rebuild. It separates the library, audio engine, renderer, preload bridge, main process, native hosts, and system integrations so the project can keep growing without piling more risk onto old code paths.

For users, the goal is a more stable large-library experience, clearer HiFi output state, safer settings and data handling, and feature boundaries that are easier to maintain over time.

## Development And Builds

Recommended environment:

| Dependency | Recommended version |
| --- | --- |
| Node.js | 20 LTS |
| npm | 9 or newer |
| Windows build tools | Visual Studio 2022 Desktop development with C++ |
| Linux build tools | CMake, g++, pkg-config, fakeroot, dpkg, rpm, binutils, and audio-related system dependencies |

```bash
git clone https://github.com/moekotori/echo.git
cd echo
npm install
npm run dev
```

If you also need to build the audio host and Windows SMTC host before launching development mode:

```bash
npm run dev:full
```

Common commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Electron + Vite development environment |
| `npm run dev:full` | Build the audio host and SMTC host, then start development mode |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run Vitest tests |
| `npm run build` | Typecheck and build main, preload, and renderer output |
| `npm run build:win` | Build Windows installer and portable artifacts |
| `npm run build:linux` | Build Linux packages on a Linux x64 environment |
| `npm run verify:ffmpeg` | Verify the FFmpeg toolchain |
| `npm run smoke:audio-host` | Smoke-test the audio host |
| `npm run smoke:smtc-host` | Smoke-test the Windows SMTC host |

Markdown-only documentation changes usually need only content review and a diff check. Playback, database, scanning, native audio host, SMTC, and packaging changes should be validated with focused checks for the touched area.

### Nix / Flake Development And Builds

The project provides a Nix flake with a dev shell, build derivation, and nixpkgs overlay:

| Command | Purpose |
| --- | --- |
| `nix develop` | Enter the dev shell (Node 22 + CMake + ALSA + GTK3 + Electron + etc.) |
| `nix build` | Build ECHO NEXT (uses system Electron, result in `result/`) |
| `nix run` | Run the built application directly |
| `nix flake check` | Verify all flake outputs |

Using the overlay in your nixpkgs configuration:

```nix
{
  inputs.echo-next.url = "github:moekotori/echo";

  outputs = { self, nixpkgs, echo-next, ... }: {
    nixosConfigurations.my-machine = nixpkgs.lib.nixosSystem {
      modules = [
        ({ pkgs, ... }: {
          nixpkgs.overlays = [ echo-next.overlays.default ];
          environment.systemPackages = [ pkgs.echo-next ];
        })
      ];
    };
  };
}
```

Or run directly:

```bash
nix run github:moekotori/echo
```

direnv users can run `direnv allow` to automatically load the development environment.

> [!IMPORTANT]
> **`nix run` produces a fully functional desktop app on Linux x86_64**, including the library SQLite, image thumbnails, IPC, playback queue and Wayland UI. See "Coverage" below.

#### Coverage

| Capability | Status | Notes |
| --- | --- | --- |
| Electron main + renderer | ✅ | Uses nixpkgs `electron_42` |
| `better-sqlite3` (library, history) | ✅ | buildPhase rebuilds it offline against `electron.headers` |
| `sharp` (cover thumbnails) | ✅ | musl variant is removed so RPATH is not mis-bound |
| Wayland / XDG data dirs | ✅ | See the "Data Directories" section |
| Pro features (Connect / AirPlay / cloud sync) | ⛔ refused | Public stubs force license-check to `false`; business logic auto-falls back to the "locked" branch |
| `native/audio-host` (JUCE HiFi/ASIO/DSD) | ⛔ missing | `cmake FetchContent` pulls JUCE 8.0.12 over the network; UI falls back to HTML Audio |
| `native-scanner` | ⛔ missing | Same reason; pure-JS scanner is used as a fallback |
| Windows / macOS | ⛔ unsupported | nixpkgs has no MSVC/WinRT; a macOS branch can be added later following Joplin's pattern |

#### Running

`LICENSE` is source-available, not OSS, so `meta.license = lib.licenses.unfree` and you must explicitly allow it:

```bash
# Ad-hoc
NIXPKGS_ALLOW_UNFREE=1 nix run --impure .#echo-next

# Or pin it in your NixOS config
nixpkgs.config.allowUnfreePredicate = pkg:
  builtins.elem (lib.getName pkg) [ "echo-next" ];
```

#### Maintenance notes

- **Updating `npmDepsHash`**: after touching `package-lock.json`, set `npmDepsHash` back to `lib.fakeHash` in `package.nix`, run `nix build .#echo-next` once, then copy the `got: sha256-…` value from the error back into the file.
- **`npm_config_nodedir` must be unset**: `npmConfigHook` injects the Node 22 source headers into the env, which overrides any `--nodedir` CLI flag. When rebuilding `better-sqlite3` you must `env -u npm_config_nodedir node-gyp …`, otherwise it links against nodejs instead of electron's V8 14 and throws `undefined symbol: v8::HandleScope::HandleScope(v8::Isolate*)` at runtime.
- **Do not drop `--ignore-scripts`**: `postinstall` runs `ensure-native-abi.mjs`, which invokes `@electron/rebuild` and downloads electron headers, which the sandbox forbids. The buildPhase replaces it with an explicit offline `node-gyp rebuild --nodedir=${electron.headers}`, which is also faster and more deterministic.
- **The sharp musl variant must be deleted**: `autoPatchelfHook` would otherwise bind `sharp-linux-x64.node`'s libvips RPATH to `sharp-libvips-linuxmusl-x64`, causing `ERR_DLOPEN_FAILED: libc.musl-x86_64.so.1` at runtime. The `rm -rf node_modules/@img/sharp-linuxmusl-x64{,-libvips}` line in buildPhase is not optional.
- **The public repo ships stubs**: `src/main/plugins/{MachineIdentity,EchoProLicensePlugin}.ts` are public stubs (see the two `!` whitelist lines in `.gitignore`); `nix build` and `npm run typecheck` succeed without the private overlay. Run `npm run pro:pull` to fetch the ECHOPrivate sibling repo when you need the real Pro features — its files override the stubs at the same paths.

#### Expected runtime warnings (not bugs)

After `nix run` you will see the following messages; **all expected**:

- `[DiscordPresence] RPC initialization failed { error: 'Could not connect' }` — Discord IPC socket is unreachable when Discord is not running.
- `wayland_wp_color_manager.cc … Unable to set image transfer function` — Chromium's own warning when the compositor lacks the `wp_color_manager` protocol; rendering is unaffected.
- `Error occurred in handler for 'connect:*': Error: echo_pro_required` — Pro stubs route Connect / AirPlay calls into the "locked" branch; expected for the public build.

### Data Directories (XDG Base Directory)

On Linux, ECHO NEXT follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/) for user data management.
Each path is resolved by checking the corresponding environment variable first, then falling back to the hardcoded default:

| Category | Environment Variable | Default | Contents |
| --- | --- | --- | --- |
| Config | `$XDG_CONFIG_HOME` | `~/.config` | `echo-settings.json`, `accounts.json`, EQ presets, etc. |
| Data | `$XDG_DATA_HOME` | `~/.local/share` | Library SQLite, playback state, plugins, wallpapers, download jobs |
| Cache | `$XDG_CACHE_HOME` | `~/.cache` | SMTC cover cache, etc. |

The actual directory is `${resolved_dir}/echo-next`. For example, the default config path is `~/.config/echo-next`.

On first startup, data from the legacy `~/.config/ECHO NEXT` directory is automatically migrated to this layout.
Windows / macOS continue to use Electron's default `userData` path and are unaffected.

## Architecture Overview

```text
React Renderer
  pages, components, virtual lists, settings, player controls
        |
Typed Preload Bridge
        |
Electron Main Process
  IPC, windows, lifecycle, services, system integration
        |
        +-- Library Core
        |     SQLite, scans, metadata, covers, folders, playlists
        |
        +-- Audio Core
        |     AudioSession, decoder pipeline, output bridge, device state
        |
        +-- Native Hosts
        |     echo-audio-host, WASAPI, ASIO, EQ, SMTC helper
        |
        +-- Experience Services
              lyrics, MV, streaming, downloads, plugins, remote sources
```

The renderer owns interaction and presentation. It should not directly scan directories, generate covers, parse audio files, or calculate authoritative playback state. The main process exposes controlled capabilities through a typed preload bridge, while heavy work is routed into the library core, audio core, native hosts, or dedicated services.

## Reporting Issues

Useful reports include your operating system, ECHO NEXT version, install type or development mode, the affected page, reproduction steps, expected behavior, actual behavior, screenshots, logs, and diagnostics. For playback issues, include output mode, output device, audio format, and whether the issue only affects certain files.

Requests to bypass memberships, copyright, platform restrictions, or DRM will not be accepted. Large platform-integration requests that do not fit the local-player direction may also be declined.

## Documentation

| Document | Contents |
| --- | --- |
| [README.md](./README.md) | Chinese README |
| [USER_GUIDE.md](./docs/USER_GUIDE.md) | User guide and feature walkthrough |
| [ECHO_NEXT_ARCHITECTURE.md](./docs/ECHO_NEXT_ARCHITECTURE.md) | Overall architecture |
| [ECHO_NEXT_LIBRARY_CORE.md](./docs/ECHO_NEXT_LIBRARY_CORE.md) | Library core |
| [ECHO_NEXT_AUDIO_CORE.md](./docs/ECHO_NEXT_AUDIO_CORE.md) | Audio core |
| [ECHO_NEXT_EQ.md](./docs/ECHO_NEXT_EQ.md) | EQ and DSP boundaries |
| [ECHO_NEXT_PLUGINS.md](./docs/ECHO_NEXT_PLUGINS.md) | Plugin authoring guide, from first plugin to debugging and packaging |
| [plugin-sdk/ForAIReadme.md](./docs/plugin-sdk/ForAIReadme.md) | Plugin-writing rules and checklist for AI assistants |
| [ECHO_NEXT_NETWORK_METADATA.md](./docs/ECHO_NEXT_NETWORK_METADATA.md) | Network metadata enrichment |
| [ECHO_NEXT_LINUX_BUILD.md](./docs/ECHO_NEXT_LINUX_BUILD.md) | Linux builds |
| [ECHO_NEXT_UI_GUIDE.md](./docs/ECHO_NEXT_UI_GUIDE.md) | UI guide |
| [flake.nix](./flake.nix) | Nix flake — dev shell, build, overlay |

## License

ECHO NEXT is source-available under the [ECHO NEXT Source-Available License](./LICENSE). The license permits personal review, learning, and local builds, but prohibits cracks, bypassing entitlement or integrity checks, and unauthorized redistribution of modified builds.
