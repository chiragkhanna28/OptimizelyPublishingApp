import {createHash} from 'node:crypto';

/**
 * Cache key for a CMS access token. It's a SHA-256 hash of the host and credentials, so any change
 * to the client ID or secret (including a rotated secret of the same length) gets a new token
 * straight away, and the secret itself never appears in the key.
 */
export function tokenCacheKey(baseUrl: string, clientId: string, clientSecret: string): string {
  return createHash('sha256').update(`${baseUrl}\n${clientId}\n${clientSecret}`).digest('hex');
}
