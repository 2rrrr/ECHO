// Public stub for the ECHO Pro private overlay.
// Real implementation lives in the ECHOPrivate sibling repository and replaces
// this file at the same path when the private overlay is checked out.
// Public builds keep this stub so `tsc --noEmit` and `nix build` succeed
// without access to private code.

import type { PluginManifest } from '../../shared/types/plugins';

export const echoProLicenseFileName = 'echo-pro-license.json';
export const echoProLicenseSignatureFileName = 'echo-pro-license.sig';

export type EchoProPluginLicense = {
  format: string;
  version: number;
  licenseId: string;
  activationId: string;
  qq: string;
  features: string[];
  pluginId: string;
  machineCodeHash: string;
  issuedAt: string;
  expiresAt: string | null;
  plan?: string;
  encryptedWatermark?: string;
};

export type EchoProPluginLicenseStatus = {
  valid: boolean;
  reason: string;
  features: string[];
  enabled: boolean;
  checkedAt: string;
  machineCode: string;
};

export const isEchoProUnlockManifest = (_manifest: PluginManifest | null | undefined): boolean => false;

export const normalizeEchoProPluginLicense = (value: unknown): EchoProPluginLicense =>
  value as EchoProPluginLicense;

export const getEchoProPluginLicenseStatus = (
  _manifest: PluginManifest | null | undefined,
  _directory: string | null,
  _enabled: boolean,
): EchoProPluginLicenseStatus => ({
  valid: false,
  reason: 'public_stub',
  features: [],
  enabled: false,
  checkedAt: new Date(0).toISOString(),
  machineCode: '',
});

export const canonicalizeEchoProLicense = (license: EchoProPluginLicense): string => JSON.stringify(license);
