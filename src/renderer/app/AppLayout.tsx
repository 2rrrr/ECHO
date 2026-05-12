import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PlayerBar } from '../components/player/PlayerBar';
import { AudioSettingsDrawer } from '../components/player/AudioSettingsDrawer';
import { readRememberedAudioOutput } from '../components/player/audioOutputMemory';
import { Sidebar } from '../components/layout/Sidebar';
import { AppTitleBar } from '../components/layout/AppTitleBar';
import type { AppRoute, AppRouteId } from './routes';
import type { AudioStatus } from '../../shared/types/audio';

type AppLayoutProps = {
  routes: AppRoute[];
};

export const AppLayout = ({ routes }: AppLayoutProps): JSX.Element => {
  const [activeRouteId, setActiveRouteId] = useState<AppRouteId>('songs');
  const [chromeNotice, setChromeNotice] = useState<string | null>(null);
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState(false);
  const [audioDrawerStatus, setAudioDrawerStatus] = useState<AudioStatus | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRoute = useMemo(
    () => routes.find((route) => route.id === activeRouteId) ?? routes[0],
    [activeRouteId, routes],
  );
  const pageContent: ReactNode = activeRoute.element;

  useEffect(() => {
    const folderInput = folderInputRef.current;

    if (!folderInput) {
      return;
    }

    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (!chromeNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setChromeNotice(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [chromeNotice]);

  useEffect(() => {
    const handleNavigateImportFolder = (): void => {
      setActiveRouteId('import-folder');
    };

    window.addEventListener('app:navigate:import-folder', handleNavigateImportFolder);
    return () => window.removeEventListener('app:navigate:import-folder', handleNavigateImportFolder);
  }, []);

  useEffect(() => {
    const audio = window.echo?.audio;

    if (!audio) {
      return;
    }

    const remembered = readRememberedAudioOutput();

    if (!remembered.enabled) {
      return;
    }

    void audio
      .setOutput({
        outputMode: remembered.outputMode,
        deviceIndex: remembered.deviceIndex,
        deviceName: remembered.deviceName,
      })
      .then(setAudioDrawerStatus)
      .catch((error) => {
        console.error('Failed to restore remembered audio output', error);
      });
  }, []);

  const notifyLibraryChanged = useCallback(async (): Promise<void> => {
    try {
      await window.echo?.library.getSummary();
    } catch {
      // Summary warmup is best-effort for direct chrome actions.
    }

    window.dispatchEvent(new Event('library:changed'));
  }, []);

  const handleImportFolder = useCallback(async (): Promise<void> => {
    const library = window.echo?.library;

    if (!library) {
      folderInputRef.current?.click();
      setChromeNotice('Browser preview opened a folder picker. Real library import uses the Electron desktop app.');
      return;
    }

    try {
      const chosenPath = await library.chooseFolder();

      if (!chosenPath) {
        return;
      }

      const folder = await library.addFolder(chosenPath);
      await library.scanFolder(folder.id);
      await notifyLibraryChanged();
    } catch (error) {
      console.error('Failed to import folder from app chrome', error);
    }
  }, [notifyLibraryChanged]);

  const handleImportFile = useCallback(async (): Promise<void> => {
    const playback = window.echo?.playback;
    const audio = window.echo?.audio;

    if (!playback) {
      fileInputRef.current?.click();
      setChromeNotice('Browser preview opened a file picker. Real playback uses the Electron desktop app.');
      return;
    }

    try {
      const filePath = await playback.openLocalAudioFile();

      if (!filePath) {
        return;
      }

      const audioStatus = await audio?.getStatus().catch(() => null);
      await playback.playLocalFile({
        filePath,
        output: audioStatus
          ? {
              outputMode: audioStatus.outputMode,
              deviceName: audioStatus.outputDeviceName ?? undefined,
            }
          : undefined,
      });
    } catch (error) {
      console.error('Failed to open local audio file from app chrome', error);
    }
  }, []);

  const handleWindowAction = useCallback(async (action: 'minimize' | 'toggleMaximize' | 'close'): Promise<void> => {
    const appApi = window.echo?.app;

    if (!appApi) {
      setChromeNotice('Window controls are available in the Electron desktop window.');
      return;
    }

    await appApi[action]();
  }, []);

  const handleBrowserFolderPicked = (files: FileList | null): void => {
    if (!files?.length) {
      return;
    }

    setChromeNotice(`Browser preview selected ${files.length} file(s). Open ECHO Next desktop to scan the folder.`);
  };

  const handleBrowserFilePicked = (files: FileList | null): void => {
    const file = files?.[0];

    if (!file) {
      return;
    }

    setChromeNotice(`Browser preview selected "${file.name}". Open ECHO Next desktop to play it through Audio Core.`);
  };

  return (
    <div className="app-shell">
      <AppTitleBar
        activeRouteId={activeRouteId}
        onRouteChange={setActiveRouteId}
        onImportFile={() => void handleImportFile()}
        onOpenAudioSettings={() => setIsAudioDrawerOpen(true)}
        onMinimize={() => void handleWindowAction('minimize')}
        onToggleMaximize={() => void handleWindowAction('toggleMaximize')}
        onClose={() => void handleWindowAction('close')}
      />

      <Sidebar
        routes={routes}
        activeRouteId={activeRouteId}
        onRouteChange={setActiveRouteId}
        onImportFolder={() => void handleImportFolder()}
        onImportFile={() => void handleImportFile()}
      />

      <main className="page-surface" key={activeRoute.id}>
        {pageContent}
      </main>

      <input
        ref={folderInputRef}
        className="browser-preview-picker"
        type="file"
        multiple
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => handleBrowserFolderPicked(event.target.files)}
      />
      <input
        ref={fileInputRef}
        className="browser-preview-picker"
        type="file"
        accept=".flac,.mp3,.wav,.m4a,.ogg,audio/*"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => handleBrowserFilePicked(event.target.files)}
      />

      {chromeNotice ? (
        <div className="chrome-notice" role="status">
          {chromeNotice}
        </div>
      ) : null}

      <AudioSettingsDrawer
        isOpen={isAudioDrawerOpen}
        status={audioDrawerStatus}
        onClose={() => setIsAudioDrawerOpen(false)}
        onStatusChange={setAudioDrawerStatus}
      />

      <PlayerBar onOpenAudioSettings={() => setIsAudioDrawerOpen(true)} />
    </div>
  );
};
