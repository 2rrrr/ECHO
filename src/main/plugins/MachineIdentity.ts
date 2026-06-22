// Public stub for the ECHO Pro private overlay.
// Real implementation lives in the ECHOPrivate sibling repository and replaces
// this file at the same path when the private overlay is checked out.
// Public builds keep this stub so `tsc --noEmit` and `nix build` succeed
// without access to private code.

export const getEchoProMachineCode = (): string => 'public-build-machine-code';
