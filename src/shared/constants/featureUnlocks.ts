export const downloadFeatureUnlockFeatureId = 'downloads';
export const downloadFeatureUnlockPluginId = 'echo.downloads-unlock';
export const downloadFeatureUnlockVersion = `plugin:${downloadFeatureUnlockPluginId}:v1`;
export const downloadFeatureUnlockCode = 'RUNIT19ORVhUX0RPV05MT0FEU19VTkxPQ0tfMjAyNg==';
export const downloadFeatureUnlockPassphrase = 'genshin impact';
export const connectDonatorUnlockFeatureId = 'connect';
export const connectDonatorUnlockPluginId = 'echo.connect-donator-unlock';
export const connectDonatorUnlockVersion = `plugin:${connectDonatorUnlockPluginId}:v1`;
export const finalThemeUnlockVersion = `plugin:${connectDonatorUnlockPluginId}:pro-themes-v1`;
export const connectDonatorHwidFileName = 'donator.allowed-hwids.json';
export const connectDonatorLicenseFileName = 'donator.machine-license.json';
export const proOnlyThemePresets = ['nyanCat', 'darkSideMoon', 'FINAL'] as const;
export type ProOnlyThemePreset = typeof proOnlyThemePresets[number];

export type ConnectDonatorUnlockReason =
  | 'plugin-missing'
  | 'plugin-disabled'
  | 'plugin-error'
  | 'hwid-file-missing'
  | 'hwid-file-invalid'
  | 'hwid-not-allowed'
  | 'license-invalid'
  | 'unlocked';

export type ConnectDonatorUnlockStatus = {
  featureId: typeof connectDonatorUnlockFeatureId;
  pluginId: typeof connectDonatorUnlockPluginId;
  requiredVersion: typeof connectDonatorUnlockVersion;
  unlocked: boolean;
  pluginInstalled: boolean;
  pluginEnabled: boolean;
  hwidHash: string;
  reason: ConnectDonatorUnlockReason;
  checkedAt: string;
};

export type DownloadFeatureUnlockReason =
  | 'plugin-missing'
  | 'plugin-disabled'
  | 'plugin-error'
  | 'unlocked';

export type DownloadFeatureUnlockStatus = {
  featureId: typeof downloadFeatureUnlockFeatureId;
  pluginId: typeof downloadFeatureUnlockPluginId;
  requiredVersion: typeof downloadFeatureUnlockVersion;
  unlocked: boolean;
  pluginInstalled: boolean;
  pluginEnabled: boolean;
  reason: DownloadFeatureUnlockReason;
  checkedAt: string;
};

export const isDownloadFeatureUnlockCode = (value: string): boolean =>
  value.trim() === downloadFeatureUnlockCode ||
  value.trim().toLowerCase() === downloadFeatureUnlockPassphrase;

export const isFinalThemeUnlockCode = (_value: string): boolean => false;
