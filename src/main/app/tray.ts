import { app, Menu, nativeImage, Tray } from 'electron';
import { getMainWindow } from './windowManager';

let tray: Tray | null = null;
let quitRequested = false;

const showMainWindow = (): void => {
  const window = getMainWindow();

  if (!window) {
    return;
  }

  window.show();
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
};

const createTrayIcon = (): Electron.NativeImage => {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#2f6f8f"/>
      <path d="M12 9v13.2a4 4 0 1 1-2-3.46V9h13v4H12z" fill="#ffffff"/>
    </svg>
  `);

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
};

export const ensureTray = (): void => {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip('ECHO NEXT');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show ECHO NEXT', click: showMainWindow },
      {
        label: 'Quit',
        click: () => {
          quitRequested = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showMainWindow);
};

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};

export const requestAppQuit = (): void => {
  quitRequested = true;
};

export const isAppQuitRequested = (): boolean => quitRequested;
