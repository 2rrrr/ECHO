import { describe, expect, it } from 'vitest';
import { areDeveloperToolsAllowed } from './securityPolicy';

describe('areDeveloperToolsAllowed', () => {
  it('allows DevTools in development builds', () => {
    expect(areDeveloperToolsAllowed(false, {})).toBe(true);
  });

  it('blocks DevTools by default in packaged builds', () => {
    expect(areDeveloperToolsAllowed(true, {})).toBe(false);
  });

  it('keeps an explicit packaged-build escape hatch for field diagnostics', () => {
    expect(areDeveloperToolsAllowed(true, { ECHO_ENABLE_DEVTOOLS: '1' })).toBe(true);
  });
});
