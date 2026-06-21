export type EchoProAccountStatus = {
  loggedIn: boolean;
  username: string | null;
  displayName: string | null;
  pro: boolean;
  status: 'anonymous' | 'active' | 'inactive' | 'disabled';
  machineCount: number;
  maxMachineCount: number;
  checkedAt: string | null;
  lastError: string | null;
};

export type EchoProAccountCredentials = {
  username: string;
  password: string;
};

export type EchoProKeyRedeemResult = {
  ok: boolean;
  redeemedAt: string;
  status: EchoProAccountStatus;
};

export type EchoProReleaseDevicesResult = {
  ok: boolean;
  releasedAt: string;
  releasedCount: number;
  status: EchoProAccountStatus;
};

export type EchoProSettingsCloudStatus = {
  available: boolean;
  lastSavedAt: string | null;
  lastPulledAt: string | null;
  lastAppliedAt: string | null;
  appVersion: string | null;
  deviceName: string | null;
  settingsCount: number;
  librarySyncPlaylistCount: number;
  librarySyncFavoriteTrackCount: number;
  lastError: string | null;
};

export type EchoProSettingsCloudSaveResult = EchoProSettingsCloudStatus & {
  savedAt: string;
};

export type EchoProSettingsCloudPullResult = EchoProSettingsCloudStatus & {
  settings: Record<string, unknown> | null;
};

export type EchoProSettingsCloudApplyResult = EchoProSettingsCloudStatus & {
  appliedAt: string;
};
