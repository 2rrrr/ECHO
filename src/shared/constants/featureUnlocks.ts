export const downloadFeatureUnlockFeatureId = 'downloads';
export const downloadFeatureUnlockPluginId = 'echo.downloads-unlock';
export const downloadFeatureUnlockVersion = `plugin:${downloadFeatureUnlockPluginId}:v1`;
export const connectDonatorUnlockFeatureId = 'connect';
export const connectDonatorUnlockPluginId = 'echo.connect-donator-unlock';
export const connectDonatorUnlockVersion = `plugin:${connectDonatorUnlockPluginId}:v1`;
export const finalThemeUnlockVersion = `plugin:${connectDonatorUnlockPluginId}:pro-themes-v1`;
export const proOnlyThemePresets = ['nyanCat', 'darkSideMoon', 'FINAL'] as const;
export type ProOnlyThemePreset = typeof proOnlyThemePresets[number];

export type ConnectDonatorUnlockReason =
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

export const isDownloadFeatureUnlockCode = (_value: string): boolean => false;

export const isFinalThemeUnlockCode = (_value: string): boolean => false;
