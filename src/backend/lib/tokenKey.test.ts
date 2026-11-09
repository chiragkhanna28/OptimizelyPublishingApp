import {describe, expect, it} from 'vitest';
import {tokenCacheKey} from './tokenKey';

const HOST = 'https://api.cms.optimizely.com';

describe('tokenCacheKey', () => {
  it('is stable for the same credentials', () => {
    expect(tokenCacheKey(HOST, 'client', 'secret-AAAA')).toBe(tokenCacheKey(HOST, 'client', 'secret-AAAA'));
  });

  it('changes when the secret is rotated, even to one of the same length', () => {
    expect(tokenCacheKey(HOST, 'client', 'secret-AAAA')).not.toBe(tokenCacheKey(HOST, 'client', 'secret-BBBB'));
  });

  it('changes when the client ID changes', () => {
    expect(tokenCacheKey(HOST, 'client-1', 'secret')).not.toBe(tokenCacheKey(HOST, 'client-2', 'secret'));
  });

  it('never contains the secret itself', () => {
    const key = tokenCacheKey(HOST, 'client', 'super-secret-value');
    expect(key).not.toContain('super-secret-value');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
