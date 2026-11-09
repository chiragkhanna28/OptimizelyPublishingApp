import {describe, expect, it} from 'vitest';
import {MAX_RETRIES, MAX_RETRY_WAIT_MS, retryDelayMs, shouldRetry} from './retry';

const noJitter = () => 0;

describe('shouldRetry', () => {
  it('retries rate limits and gateway errors, up to MAX_RETRIES', () => {
    expect(shouldRetry(429, 0)).toBe(true);
    expect(shouldRetry(503, 1)).toBe(true);
    expect(shouldRetry(429, MAX_RETRIES)).toBe(false);
  });

  it('never retries success or client errors', () => {
    expect(shouldRetry(200, 0)).toBe(false);
    expect(shouldRetry(400, 0)).toBe(false);
    expect(shouldRetry(401, 0)).toBe(false);
    expect(shouldRetry(404, 0)).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('honours Retry-After seconds', () => {
    expect(retryDelayMs('2', 0, noJitter)).toBe(2000);
  });

  it('backs off exponentially without Retry-After', () => {
    expect(retryDelayMs(null, 0, noJitter)).toBe(500);
    expect(retryDelayMs(null, 1, noJitter)).toBe(1000);
    expect(retryDelayMs(null, 2, noJitter)).toBe(2000);
  });

  it('ignores an unparseable Retry-After (for example an HTTP date)', () => {
    expect(retryDelayMs('Wed, 21 Oct 2026 07:28:00 GMT', 0, noJitter)).toBe(500);
  });

  it('caps the wait so a call stays inside the ~59 s limit', () => {
    expect(retryDelayMs('60', 0, noJitter)).toBe(MAX_RETRY_WAIT_MS);
    expect(retryDelayMs(null, 10, () => 0.99)).toBe(MAX_RETRY_WAIT_MS);
  });
});
