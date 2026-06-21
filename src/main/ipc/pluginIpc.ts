import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/constants/ipcChannels';
import type {
  PluginCreateExampleKind,
  PluginEnableRequest,
  PluginCoverLookupRequest,
  PluginLyricsLookupRequest,
  PluginMetadataLookupRequest,
  PluginRunCommandRequest,
  PluginSettingsPatch,
  PluginSourcePlaybackRequest,
  PluginSourceSearchRequest,
} from '../../shared/types/plugins';
import { getPluginService } from '../plugins/PluginService';
import { requirePrivateFeature } from '../plugins/privateEntitlements';

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
};

const exampleKinds = new Set<PluginCreateExampleKind>(['playback-panel', 'command-tool', 'library-script', 'source-provider', 'theme-preset']);

export const registerPluginIpc = (): void => {
  const service = getPluginService();
  void requirePrivateFeature('plugins')
    .then(() => service.scheduleAutoStart())
    .catch(() => undefined);

  ipcMain.handle(IpcChannels.PluginsList, () => service.list());
  ipcMain.handle(IpcChannels.PluginsCreateExample, async (_event, kind: unknown) => {
    if (typeof kind !== 'string' || !exampleKinds.has(kind as PluginCreateExampleKind)) {
      throw new Error('unknown_plugin_example_kind');
    }
    await requirePrivateFeature('plugins');
    return service.createExample(kind as PluginCreateExampleKind);
  });
  ipcMain.handle(IpcChannels.PluginsEnable, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin enable request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.enable(request as PluginEnableRequest);
  });
  ipcMain.handle(IpcChannels.PluginsDisable, (_event, pluginId: unknown) => service.disable(requireText(pluginId, 'pluginId')));
  ipcMain.handle(IpcChannels.PluginsDelete, (_event, pluginId: unknown) => service.deletePlugin(requireText(pluginId, 'pluginId')));
  ipcMain.handle(IpcChannels.PluginsReload, async (_event, pluginId: unknown) => {
    const id = requireText(pluginId, 'pluginId');
    await requirePrivateFeature('plugins');
    return service.reload(id);
  });
  ipcMain.handle(IpcChannels.PluginsOpenDirectory, (_event, pluginId: unknown) =>
    service.openDirectory(typeof pluginId === 'string' && pluginId.trim() ? pluginId.trim() : undefined),
  );
  ipcMain.handle(IpcChannels.PluginsExportPackage, async (_event, pluginId: unknown) => {
    const id = requireText(pluginId, 'pluginId');
    await requirePrivateFeature('plugins');
    return service.exportPluginPackage(id);
  });
  ipcMain.handle(IpcChannels.PluginsImportPackage, async (_event, sourcePath: unknown) => {
    await requirePrivateFeature('plugins');
    return service.importPluginPackage(typeof sourcePath === 'string' && sourcePath.trim() ? sourcePath.trim() : undefined);
  });
  ipcMain.handle(IpcChannels.PluginsRunCommand, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin command request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.runCommand(request as PluginRunCommandRequest);
  });
  ipcMain.handle(IpcChannels.PluginsQueryMetadata, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin metadata request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.queryMetadata(request as PluginMetadataLookupRequest);
  });
  ipcMain.handle(IpcChannels.PluginsQuerySources, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin source search request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.querySources(request as PluginSourceSearchRequest);
  });
  ipcMain.handle(IpcChannels.PluginsResolveSourcePlayback, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin source playback request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.resolveSourcePlayback(request as PluginSourcePlaybackRequest);
  });
  ipcMain.handle(IpcChannels.PluginsQueryLyrics, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin lyrics request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.queryLyrics(request as PluginLyricsLookupRequest);
  });
  ipcMain.handle(IpcChannels.PluginsQueryCovers, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('plugin cover request must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.queryCovers(request as PluginCoverLookupRequest);
  });
  ipcMain.handle(IpcChannels.PluginsGetSettings, async (_event, pluginId: unknown) => {
    const id = requireText(pluginId, 'pluginId');
    await requirePrivateFeature('plugins');
    return service.getPluginSettings(id);
  });
  ipcMain.handle(IpcChannels.PluginsSetSettings, async (_event, pluginId: unknown, patch: unknown) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('plugin settings patch must be an object');
    }
    await requirePrivateFeature('plugins');
    return service.updatePluginSettings(requireText(pluginId, 'pluginId'), patch as PluginSettingsPatch);
  });
  ipcMain.handle(IpcChannels.PluginsGetLogs, (_event, pluginId: unknown) =>
    service.getLogs(typeof pluginId === 'string' && pluginId.trim() ? pluginId.trim() : undefined),
  );
};
