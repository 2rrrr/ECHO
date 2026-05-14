export type UpdateCheckState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error' | 'disabled';

export type UpdateStatus = {
  state: UpdateCheckState;
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  error: string | null;
  checkedAt: string | null;
};
