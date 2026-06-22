<p align="center">
  <img src="./build-resources/icons/logo.png" alt="ECHO NEXT" width="520" />
</p>

<h1 align="center">ECHO NEXT</h1>

<p align="center">
  <strong>面向本地曲库、HiFi 输出和长期维护的源码可见桌面音乐播放器</strong>
</p>

<p align="center">
  <a href="./README_EN.md">English README</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://echonagi.com/">&#23448;&#32593;</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://echonext.moe/zh/docs/">官方文档</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://github.com/moekotori/echo/releases/latest">Latest Release</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://afdian.com/a/echonext">爱发电</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="#项目架构">项目架构</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://qm.qq.com/q/OdpngxJU86">QQ 群聊</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://discord.gg/g7v4WMRq3K">Discord</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="#快速开始">快速开始</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/USER_GUIDE.md">用户教程</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/USER_GUIDE.md#plugins-插件">插件教程</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/ECHO_NEXT_PLUGINS.md">插件制作</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="https://echonext.moe/zh/developer/">开发者计划</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="./docs/ECHO_NEXT_LINUX_BUILD.md">Linux 构建指南</a>
  <span>&nbsp;|&nbsp;</span>
  <a href="#开发与构建">开发与构建</a>
</p>

<p align="center"><strong>反馈问题请保持礼貌；提问前建议先查阅 <a href="https://echonext.moe/zh/docs/">官方文档</a>、README 和相关教程。</strong></p>

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

> [!TIP]
> Debug 小提示：遇到设备或播放异常，先到 **设置 > 播放** 打开 **低负载播放模式**；反馈问题时请到 **设置 > 关于 > 打开控制台**，复制报错或导出日志。若只有某一首歌异常，请先换其他歌曲确认，单曲问题通常更可能来自文件本身。第三方音频驱动/包装层导致的问题不作为有效 issue 受理。
> 更新优先级：**音频稳定性 > HiFi > 杂项功能 > 流媒体**。

---

## 项目定位

ECHO NEXT 是 ECHO 系列的下一代桌面音乐播放器工程。它不是旧版本的简单换皮，而是围绕本地曲库、播放稳定性、原生音频输出、歌词、MV、远程来源、插件和桌面集成重新拆分架构边界。

项目优先级很明确：本地播放可靠，音频链路稳定，大曲库不卡顿，用户数据安全，网络能力只作为补全和扩展，不把播放器变成依赖在线平台的壳。

如果你只是想快速使用或排查问题，优先看 [ECHO NEXT 官方文档](https://echonext.moe/zh/docs/)。线上文档会持续补充安装、播放、曲库、插件、音频输出、Linux 构建和常见问题，比单个 README 更适合做长期索引。

> [!IMPORTANT]
> ECHO NEXT 的核心仍然是本地音乐播放器。反馈问题请尽量提供可复现步骤、系统环境、版本、截图、日志和你实际操作的路径。
> 任何绕过会员、版权、平台限制或违反 DMCA 的功能请求都不会被接受。
> 情绪化表达、无复现依据的指责、针对个人审美或使用偏好的争论，也不会作为有效 issue 处理。

## 项目架构

ECHO NEXT 不是纯网页播放器。React 只负责界面和交互呈现，真正的曲库、播放、系统集成和原生音频输出由桌面后端与原生模块分层完成。

| 层 | 主要职责 |
| --- | --- |
| React Renderer | 页面、列表、歌词、MV、设置和播放器控制界面 |
| Preload / IPC Bridge | 在渲染层和主进程之间暴露受控 API，隔离 Node / 原生权限 |
| Electron Main Services | 窗口生命周期、曲库扫描、SQLite、缓存、元数据、插件、远程来源和诊断 |
| Native Audio Host | WASAPI Shared / Exclusive、ASIO、设备状态、低延迟输出和播放恢复边界 |

所以 ECHO NEXT 的前端不是完整产品本身，而是桌面服务和原生播放能力的可视化控制面。完整架构说明见 [docs/ECHO_NEXT_ARCHITECTURE.md](./docs/ECHO_NEXT_ARCHITECTURE.md)。

## 当前技术栈

| 方向 | 当前选择 |
| --- | --- |
| 桌面内核 | Electron 42.x |
| 构建框架 | electron-vite 5.x、Vite 7.x |
| 界面 | React 18.2、TypeScript 5.x |
| 打包 | electron-builder 26.x、NSIS、portable、AppImage、deb |
| 曲库 | SQLite、better-sqlite3、native scanner、metadata worker |
| 音频 | HTML Audio fallback、Native Audio Host、WASAPI Shared / Exclusive、ASIO |
| 扩展 | 插件 SDK、远程来源、网络元数据、下载器、局域网播放能力 |

版本号以 [`package.json`](./package.json) 和 [`package-lock.json`](./package-lock.json) 为准；如果 README、文档或发布说明与锁文件冲突，请优先相信锁文件并提交文档修正。

## 音频输出建议

ECHO NEXT 会持续改善原生音频输出的稳定性，但不鼓励迷信“接口名称”。真正决定声音表现的核心仍然是 DAC / 声卡 / 耳放 / 耳机等硬件本身，而不是播放器里是否显示 ASIO 或独占。

- **ASIO**：优先使用设备原厂 ASIO 驱动。ASIO4ALL、FlexASIO、Voicemeeter 等第三方 ASIO 包装层行为不可控，通常也不会让不支持原生 ASIO 的设备获得真正音质提升；仅由此类包装层引起的问题，后续不作为专项维护方向。
- **WASAPI Exclusive**：更适合外置 DAC、USB 声卡和专业音频接口。电脑耳机孔、笔记本 3.5mm 或主板集成声卡通常没有必要强行开启独占，系统输出或 WASAPI Shared 往往更稳定省心。

## 适合谁

| 你想要 | ECHO NEXT 的侧重点 |
| --- | --- |
| 管理自己的本地音乐文件 | 文件夹扫描、SQLite 曲库、标签读取、封面缓存、专辑聚合 |
| 在 Windows 上认真调输出 | 系统输出、WASAPI、ASIO、EQ、采样率状态、bit-perfect 提示 |
| 大曲库下界面仍然稳 | 歌曲列表、专辑墙和封面加载尽量分页、缓存、虚拟化 |
| 歌词、MV、封面和元数据可控 | 自动匹配辅助，手动选择、来源优先级和本地缓存更重要 |
| 想扩展但不想破坏主程序 | 插件、远程库、下载器、流媒体和网络元数据都放在受控边界里 |

## 核心能力

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>本地曲库</strong><br />
      导入文件夹、歌曲列表、专辑墙、艺术家、收件箱、收藏、历史、播放列表、重复歌曲筛选、标签编辑。
    </td>
    <td width="33%" valign="top">
      <strong>稳定播放</strong><br />
      播放队列、底部播放器、系统媒体控制、输出设备状态、播放诊断、错误提示和恢复边界。
    </td>
    <td width="33%" valign="top">
      <strong>HiFi 输出</strong><br />
      WASAPI Shared、WASAPI Exclusive、ASIO、EQ、Preamp、ReplayGain、采样率状态和 bit-perfect 提示。
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>歌词与 MV</strong><br />
      本地歌词、在线候选、翻译、罗马音、日文假名增强、歌词偏移、MV 匹配、质量选择和外部播放边界。
    </td>
    <td width="33%" valign="top">
      <strong>网络扩展</strong><br />
      WebDAV、Jellyfin、Emby、SMB、SSHFS、Subsonic、流媒体搜索、下载器、网络代理和远程后台任务。
    </td>
    <td width="33%" valign="top">
      <strong>维护诊断</strong><br />
      插件权限、日志、崩溃恢复、曲库健康、缓存迁移、设置备份、危险操作确认。
    </td>
  </tr>
</table>

## 快速开始

### 获取发布版

普通用户优先从 [GitHub Releases](https://github.com/moekotori/echo/releases/latest) 下载。Windows 用户通常选择安装包或便携版；Linux 用户可以选择 AppImage 或 deb 包，具体取决于发布版本提供的构建产物。

首次启动后，建议先导入一个较小的音乐文件夹确认扫描、封面、播放和歌词入口正常，再导入完整曲库。

### 推荐上手路线

| 阶段 | 做什么 |
| --- | --- |
| 1 | 导入一个小音乐文件夹 |
| 2 | 在 `Songs`、`Albums`、`Inbox` 检查歌曲、封面、专辑聚合 |
| 3 | 试用播放、收藏、加入队列、加入歌单、右键菜单 |
| 4 | 调整歌词、MV、EQ、输出设备和外观 |
| 5 | 需要时再启用远程来源、流媒体、下载器和插件 |

完整教程见 [docs/USER_GUIDE.md](./docs/USER_GUIDE.md)。

## 页面速查

| 页面 | 用途 |
| --- | --- |
| `Songs` | 全曲库浏览、搜索、排序、批量选择、标签编辑、重复歌曲筛选 |
| `Albums` | 专辑墙、专辑详情、整张播放、专辑封面和标签整理 |
| `Artists` | 按艺术家浏览歌曲和专辑 |
| `Folders` | 管理本地导入目录和扫描状态 |
| `Inbox` | 查看新扫描进入曲库的歌曲 |
| `Queue` | 管理临时播放顺序 |
| `Liked` | 快速收藏常听歌曲 |
| `History` | 找回最近播放内容 |
| `Playlists` | 管理长期歌单 |
| `Lyrics` | 沉浸式歌词和播放页 |
| `Streaming` | 在线搜索、试听、发现候选 |
| `Downloads` | URL 下载、搜索下载、导入曲库 |
| `Cloud / Remote` | 远程来源和远程库索引 |
| `Connect` | DLNA、AirPlay 等局域网播放能力 |
| `Plugins` | 本地插件、权限、日志、导入导出 |
| `Settings` | 播放、歌词、MV、EQ、外观、曲库、集成、诊断和危险操作 |

## ECHO NEXT 和 ECHO 的区别

ECHO 是上一代完整播放器，重点是把本地播放、歌词、MV、下载、插件、投屏和共听等体验集中在一个桌面应用里。

ECHO NEXT 更像一次底层重建。它把曲库、音频、Renderer、Preload、主进程、原生宿主和系统集成分层，避免在旧代码上继续堆功能。对用户来说，它追求更稳定的大曲库体验、更清晰的 HiFi 输出状态、更可靠的设置和更容易维护的功能边界。

如果你想要成熟功能集合，可以关注 ECHO；如果你更关心下一代架构、性能、Linux 适配和后续 HiFi 能力，ECHO NEXT 是新的主线。

## ECHO 开发者计划

如果你想更深入参与 ECHO NEXT，可以申请加入 [ECHO 开发者计划](https://echonext.moe/zh/developer/)。

通过开发者申请后，你可以访问开发者仓库，参与更早期的功能讨论、开发和测试；符合条件的开发者也可以免费获得 ECHO Next Pro 等权益。申请时请准备以下信息：

| 信息 | 说明 |
| --- | --- |
| GitHub | 用于确认代码贡献、开发经历和仓库协作身份 |
| QQ | 用于开发者沟通、审核联系和后续协作 |
| 开发经验 | 简要说明你熟悉的语言、框架、项目经历或相关作品 |

如果你有 Codeforces、AtCoder、洛谷等算法竞赛主页，也可以一并提供；这不是硬性要求，但会作为额外加分项。

## 开发与构建

开发环境推荐：

| 依赖 | 推荐版本 |
| --- | --- |
| Node.js | 20 LTS |
| npm | 9 或更高 |
| Windows 构建工具 | Visual Studio 2022 Desktop development with C++ |
| Linux 构建工具 | CMake、g++、pkg-config、fakeroot、dpkg、rpm、binutils 和音频相关依赖 |

```bash
git clone https://github.com/moekotori/echo.git
cd echo
npm install
npm run dev
```

如果你需要同时构建音频宿主和 Windows SMTC 宿主：

```bash
npm run dev:full
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Electron + Vite 开发环境 |
| `npm run dev:full` | 构建音频宿主和 SMTC 宿主后启动开发环境 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run build` | 类型检查并构建主进程、预加载和渲染进程 |
| `npm run build:win` | 构建 Windows 安装包和便携版 |
| `npm run build:linux` | 在 Linux x64 环境构建 Linux 包 |
| `npm run verify:ffmpeg` | 检查 FFmpeg 工具链 |
| `npm run smoke:audio-host` | 音频宿主烟测 |
| `npm run smoke:smtc-host` | Windows SMTC 宿主烟测 |

文档改动通常只需要检查内容和格式；播放、数据库、扫描、音频宿主、SMTC、打包等改动再按对应范围做 focused check。

### Nix / Flake 开发与构建

项目提供 Nix flake，包含开发环境、构建 derivation 和 nixpkgs overlay：

| 命令 | 用途 |
| --- | --- |
| `nix develop` | 进入开发 shell（Node 22 + CMake + ALSA + GTK3 + Electron 等） |
| `nix build` | 构建 ECHO NEXT（使用系统 Electron，产物在 `result/`） |
| `nix run` | 直接运行构建产物 |
| `nix flake check` | 验证 flake 各 output 正确性 |

将 overlay 加入你的 nixpkgs 配置：

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

或临时运行：

```bash
nix run github:moekotori/echo
```

direnv 用户可执行 `direnv allow` 自动加载开发环境。

> [!IMPORTANT]
> **`nix run` 在 Linux x86_64 上已经可以直接拉起完整桌面应用**，包含曲库 SQLite、图像缩略图、IPC、播放队列、Wayland UI；详见下文"覆盖范围"。

#### 覆盖范围

| 能力 | 状态 | 备注 |
| --- | --- | --- |
| Electron 主进程 + Renderer | ✅ | 用 nixpkgs `electron_42` |
| `better-sqlite3` (曲库、播放历史) | ✅ | buildPhase 用 `electron.headers` 离线 rebuild |
| `sharp` (封面缩略图) | ✅ | 仅保留 glibc 变种，删除 musl 变种避免 RPATH 错绑 |
| Wayland / XDG 数据目录 | ✅ | 详见"数据目录"章节 |
| Pro 功能 (Connect / AirPlay / 云同步) | ⛔ 拒绝 | 公开 stub 把 license 校验置 false，业务自动走"未解锁"分支 |
| `native/audio-host` (JUCE HiFi/ASIO/DSD) | ⛔ 缺失 | `cmake FetchContent` 拉 JUCE 8.0.12 需联网；UI 自动回退到 HTML Audio |
| `native-scanner` | ⛔ 缺失 | 同上，使用纯 JS scanner 兜底 |
| Windows / macOS 平台 | ⛔ 不支持 | nixpkgs 没有 MSVC/WinRT；macOS 分支可参照 Joplin 后续添加 |

#### 运行

`LICENSE` 是 source-available 非 OSS 许可，`meta.license = lib.licenses.unfree`，因此必须显式允许：

```bash
# 一次性
NIXPKGS_ALLOW_UNFREE=1 nix run --impure .#echo-next

# 或在 NixOS 配置里固定允许
nixpkgs.config.allowUnfreePredicate = pkg:
  builtins.elem (lib.getName pkg) [ "echo-next" ];
```

#### 维护要点

- **`npmDepsHash` 更新**：改完 `package-lock.json` 后，把 `package.nix` 里的 `npmDepsHash` 改回 `lib.fakeHash`，运行一次 `nix build .#echo-next`，从报错里的 `got: sha256-…` 复制回写。
- **`npm_config_nodedir` 必须 unset**：`npmConfigHook` 会把 Node 22 source 注入 env，覆盖 `--nodedir` CLI；rebuild `better-sqlite3` 时必须 `env -u npm_config_nodedir node-gyp …`，否则会链接到 nodejs 而非 electron 的 V8 14，运行期抛 `undefined symbol: v8::HandleScope::HandleScope(v8::Isolate*)`。
- **不要把 `--ignore-scripts` 拿掉**：`postinstall` 里的 `ensure-native-abi.mjs` 走 `@electron/rebuild` 联网下载 electron headers，sandbox 必跪；当前用 buildPhase 内显式 `node-gyp rebuild --nodedir=${electron.headers}` 取代它，更可控也更快。
- **sharp musl 变种必须删**：`autoPatchelfHook` 会把 `sharp-linux-x64.node` 的 libvips RPATH 优先绑到 `sharp-libvips-linuxmusl-x64`，运行期 dlopen 触发 `ERR_DLOPEN_FAILED: libc.musl-x86_64.so.1`。buildPhase 里 `rm -rf node_modules/@img/sharp-linuxmusl-x64{,-libvips}` 这一行不可省。
- **公开仓自带 stub**：`src/main/plugins/{MachineIdentity,EchoProLicensePlugin}.ts` 是公开 stub（详见 `.gitignore` 的 `!` 白名单两行），`nix build` 与 `npm run typecheck` 无需私有 overlay 即可通过。要启用 Pro 真实能力请用 `npm run pro:pull` 拉 ECHOPrivate 兄弟仓，私有文件以同名覆盖 stub。

#### 已知运行时降级日志（非 Bug）

`nix run` 启动后会看到以下日志，**全部预期**：

- `[DiscordPresence] RPC initialization failed { error: 'Could not connect' }` — Discord IPC socket 不可达，未运行 Discord 即如此。
- `wayland_wp_color_manager.cc … Unable to set image transfer function` — 运行环境不支持 `wp_color_manager` 协议，Chromium 自身的 warning，不影响渲染。
- `Error occurred in handler for 'connect:*': Error: echo_pro_required` — Pro stub 触发的"未解锁"分支，对应 Connect / AirPlay 等付费功能；公开版预期行为。

### 数据目录（XDG Base Directory）

Linux 上 ECHO NEXT 遵循 [XDG Base Directory 规范](https://specifications.freedesktop.org/basedir-spec/) 管理用户数据。
路径按以下顺序确定：先读取对应环境变量，若未设置则回退到硬编码默认值。

| 目录 | 环境变量 | 默认值 | 内容 |
| --- | --- | --- | --- |
| 配置 | `$XDG_CONFIG_HOME` | `~/.config` | `echo-settings.json`、`accounts.json`、EQ 预设等 |
| 数据 | `$XDG_DATA_HOME` | `~/.local/share` | 曲库 SQLite、播放记录、插件、壁纸、下载任务 |
| 缓存 | `$XDG_CACHE_HOME` | `~/.cache` | SMTC 封面缓存等 |

实际目录为 `${对应目录}/echo-next`，例如默认配置为 `~/.config/echo-next`。

首次启动时会自动将旧 `~/.config/ECHO NEXT` 中的数据迁移到以上布局。
Windows / macOS 继续使用 Electron 默认的 `userData` 路径，不受影响。

## 架构概览

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

Renderer 只负责交互和展示，不直接扫描目录、不生成封面、不解析音频文件、不计算权威播放进度。主进程通过类型化 IPC 暴露受控能力，重任务进入 Library Core、Audio Core、原生宿主或独立服务。

## 算法致敬

ECHO NEXT 不是算法竞赛项目，但很多体验都离不开 ACM / ICPC 那类经典算法思想。这里记录项目实际用到或直接借鉴的部分，也向这些朴素但可靠的算法致敬。

| 场景 | 使用到的算法思想 |
| --- | --- |
| 歌词、封面和网络元数据匹配 | N-gram / Sørensen-Dice 相似度、Token overlap / Jaccard 思路、加权评分、阈值判定 |
| 歌词候选自动选择 | 多字段打分、版本标签冲突检测、时长差分、风险分层和优先级排序 |
| 重复歌曲识别 | 字符串归一化、哈希桶 / 分组键、近似时长聚类、版本标记冲突过滤 |
| 大曲库扫描和远程后台任务 | 队列调度、分块处理、去重集合、限流并发、优先级排序和让出事件循环 |
| 本地曲库查询与缓存 | SQLite 索引、增量快照、缓存键、分页和虚拟化列表 |

也特别致敬 KMP、Trie、AC 自动机、动态规划、图搜索、并查集、堆和最短路这些经典算法训练。即使它们不一定都以教科书形态出现在代码里，工程里的“快、稳、边界清楚”，很多都来自这些基础训练。

## 反馈规范

有效反馈应包含：系统版本、ECHO NEXT 版本、安装版或开发模式、问题页面、复现步骤、预期行为、实际行为、截图、日志或诊断报告。如果是播放问题，请附上输出模式、设备、音频格式，以及是否只影响某些文件。

不接受绕过会员、版权、平台限制或 DRM 的请求。不接受没有复现路径的情绪化否定，也不接受与本地播放器核心方向无关的大型平台接入要求。

提 issue 前建议先做三件事：

| 步骤 | 说明 |
| --- | --- |
| 查文档 | 先看 [官方文档](https://echonext.moe/zh/docs/)、README 和相关教程，很多安装、播放、曲库、插件问题已有说明 |
| 留证据 | 截图、日志、控制台输出、复现路径和设备信息，比一句“不能用”更容易定位 |
| 缩范围 | 先确认是否只影响某首歌、某个输出设备、某个插件或某个网络来源 |

## 提问规范参考

以下内容转载自 [Stop-Ask-Questions-The-Stupid-Ways](https://github.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/blob/master/README.md)，用于补充反馈问题前应提供的信息。

# 别像弱智一样提问

Stop-Ask-Questions-The-Stupid-Ways

## 短域名服务

+ https://git.io/how-to-ask
+ https://git.io/asking-question
+ https://git.io/stop-stupid

## 你真的准备好了吗？

![you-are-not-prepared.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/you-are-not-prepared.png)

> 感谢群友 `for you` 提供

## 避免 xy-problem

+ 参考地址: http://xyproblem.info/

`XY Problem` 表示
1. 提问者想要解决 **原问题 X** ，且觉得解决了 **引申问题 Y** 就能解决 **X** 问题
2. ~~提问者对外提出了解决 **Y** 的的请求~~
3. 回答者帮助提问者解决 **Y** 问题。（浪费了回答者和提问者双方的时间）

> `然而, 最终 Y 问题可能并不是 X 问题的一个合适的解决方法`

因此， 提问者要避免创造这样的修罗场, 需要学会在问题之初就准确描述自己的根本问题。 [学会描述问题](#学会描述问题)

## 提问前你必须需要知道的事情

1. 要知道， `Free` 的正确翻译是 `自由`，而非 **~~`免费`~~**。
1. 要知道，愿意回答问题的人，都是 **可爱** 的人。
1. 要知道，向帮助你的人 `付费` 是一个高尚的行为。即使回答你的人不是为了钱。
1. 要知道，`花钱买时间是一个常识`。如果你不能认同，要么你钱包穷，要么你思想穷。
1. 要知道，给对方发工资的不是你或者你老板。
1. 要知道，提问的时候你才是 **孙子**，帮助你的人是 **大爷**。
1. 要知道，不回答你的问题对其他人没有任何损失。
1. 要知道，`准确描述一件事情`是一项基本生存技能。要学会 [《提问的智慧》](https://github.com/ryanhanwu/How-To-Ask-Questions-The-Smart-Way/blob/master/README-zh_CN.md)
1. 要知道，`搜索`是一项基本生存技能，学不会用 Google 的话，你可能真的不适合你所从事的行业。
1. 要知道，`英文`是一项基本生存技能，不认识英文的话，你可能真的不适合你所从事的行业。

## 幼儿园的小朋友都知道要有礼貌

```
请问
  ...问题描述...
谢谢
```

![manners-maketh-man.jpg](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/manners-maketh-man-small.png)

## 学会描述问题

> 向别人提问的时候，要学会正确的描述问题。
> 把对方当成你的老板，你在给他做报告。要用最精炼的文字和图片，向对方阐述明白一个事情的来龙去脉。

> **要知道，你不是我追的妹子，我没有时间来猜你想要什么。**

> 记住，给别人的条件越多，你的问题解决越快。因为这不是解密游戏。

1. 请问一个关于 `什么` 的问题。
1. 我想要达到 `什么样` 效果，但是我这样做出现了 `什么样` 的问题。
1. 报错日志是 `这样` 的。（要 `学会` 画关键字）
1. 我尝试过 `什么` 方法来解决。
1. 我尝试搜索过了 `什么` 关键字，在里面找到了 `这些 URL` 的回答，尝试了还是没有解决问题。
1. 我用的是 `什么` 操作系统，版本号是多少。
1. 我用的是 `什么` 软件，版本号是多少。
1. 谢谢

> 千万别认为只有别人帮助你之后才需要说 `谢谢`。

### 学会什么时候贴图

![what-time-to-use-image.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/what-time-to-use-image.png)

像这种，IM 自动转义表情，贴出来的问题全是表情。

### 学会什么时候要圈出重点

千万不要认为别人的频率和你是同步的，然后像这样扔出一张图一个表情就了事了。

在工作中， 你`@`的人可能会多问一句什么情况。 但是在 IM 聊天群里面，就没有这么好运气了。

![stupid_02-conversation.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/stupid_questions/stupid_02-conversation.png)

如下很难吗？

```
@xxx，我这边访问不了 git 仓库。
环境是: 环境是什么。
```

![stupid_02-no-target.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/stupid_questions/stupid_02-no-target.png)

### 学会什么时候贴文字

## 什么是弱智一样的提问

![stupid_questions.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/stupid_questions/stupid_questions.png)

## 萌新滚粗

![baiduit.jpg](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/baiduit.jpg)

| 什么鬼？    | 咋回事？  | 怎么办？    | 救命啊！！       |
|-------------|-------------|-------------|------------------|
| 自己 google | 自己 google | 自己 google | 自己 google 了吗 |

![googleit.png](https://raw.githubusercontent.com/tangx/Stop-Ask-Questions-The-Stupid-Ways/master/images/googleit.png)

## 相关文档

| 文档 | 内容 |
| --- | --- |
| [ECHO NEXT 官方文档](https://echonext.moe/zh/docs/) | 在线文档入口，适合查教程、排障和长期维护说明 |
| [USER_GUIDE.md](./docs/USER_GUIDE.md) | 用户教程和功能说明 |
| [ECHO_NEXT_ARCHITECTURE.md](./docs/ECHO_NEXT_ARCHITECTURE.md) | 总体架构 |
| [ECHO_NEXT_LIBRARY_CORE.md](./docs/ECHO_NEXT_LIBRARY_CORE.md) | 曲库核心 |
| [ECHO_NEXT_AUDIO_CORE.md](./docs/ECHO_NEXT_AUDIO_CORE.md) | 音频核心 |
| [ECHO_NEXT_DSP_BEGINNER_GUIDE.md](./docs/ECHO_NEXT_DSP_BEGINNER_GUIDE.md) | DSP 新手教程和数字音频科普 |
| [ECHO_NEXT_DSP_SIMPLE_GUIDE.md](./docs/ECHO_NEXT_DSP_SIMPLE_GUIDE.md) | DSP Simple 模式白话教程 |
| [ECHO_NEXT_EQ.md](./docs/ECHO_NEXT_EQ.md) | EQ 与 DSP 边界 |
| [ECHO_NEXT_PLUGINS.md](./docs/ECHO_NEXT_PLUGINS.md) | 插件制作指南，从零创建、启用、调试和发布插件 |
| [plugin-sdk/ForAIReadme.md](./docs/plugin-sdk/ForAIReadme.md) | 给 AI 读取的插件编写规则和检查清单 |
| [ECHO_NEXT_NETWORK_METADATA.md](./docs/ECHO_NEXT_NETWORK_METADATA.md) | 网络元数据补全 |
| [ECHO_NEXT_LINUX_BUILD.md](./docs/ECHO_NEXT_LINUX_BUILD.md) | Linux 构建 |
| [ECHO_NEXT_UI_GUIDE.md](./docs/ECHO_NEXT_UI_GUIDE.md) | UI 指南 |
| [flake.nix](./flake.nix) | Nix flake — 开发环境、构建、overlay |

## ECHO Next Pro

<p align="center">
  <img src="./build-resources/icons/lmao.jpeg" alt="ECHO Next Pro" width="720" />
</p>

ECHO Next Pro 是给长期支持 ECHO NEXT 的用户准备的进阶权益入口。通过爱发电支持项目后，可以获得更多实验性与扩展能力；所有为项目做出贡献的 GitHub 用户也将免费获得此权益。

> [!NOTE]
> GitHub Contributors Only: 所有为 ECHO NEXT 项目做出贡献的用户将免费获得 ECHO Next Pro 权益。

ECHO Next Pro 当前包含：

- 解锁 ECHO Connect 功能，可以连接 ECHO Mobile 安卓端并共享曲库。
- 抢先体验 ECHO 手机版。
- 解锁所有主题。
- 解锁网盘连接功能。
- 解锁 ECHO 插件功能。
- 加入 ECHO Donators 群。

支持入口：[https://afdian.com/a/echonext](https://afdian.com/a/echonext)

## English Summary

ECHO NEXT is a source-available desktop music player focused on local libraries, stable playback, HiFi-oriented output, lyrics, MV, remote sources, plugins, and maintainable Electron architecture.

The project prioritizes local ownership and playback stability over online-platform dependency. See [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) for the full Chinese user guide.

## License

ECHO NEXT is source-available under the [ECHO NEXT Source-Available License](./LICENSE). The license permits personal review, learning, and local builds, but prohibits cracks, bypassing entitlement or integrity checks, and unauthorized redistribution of modified builds.

## Star 趋势

<p align="center">
  <a href="https://star-history.com/#moekotori/echo&Date">
    <img src="https://api.star-history.com/svg?repos=moekotori/echo&type=Date" alt="Star History Chart" />
  </a>
</p>
