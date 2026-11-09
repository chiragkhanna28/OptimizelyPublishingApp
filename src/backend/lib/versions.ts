import type {ChildRecord, VersionSummary} from '@shared/protocol';

/*
 * Pure helpers for reading CMS (SaaS) REST API v1 responses. No I/O, no App SDK imports,
 * so they are unit-tested directly (versions.test.ts).
 *
 * The response field names aren't fully documented yet (CMS UI extensions are beta), so parsing
 * is tolerant: lists may come as `items`, `data` or `results`, version IDs as `version` or `id`.
 */

export type Json = Record<string, unknown>;

export function asString(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number') return String(value);
  return null;
}

export function listOf(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  if (body && typeof body === 'object') {
    const b = body as Json;
    for (const field of ['items', 'data', 'results']) {
      if (Array.isArray(b[field])) return b[field] as Json[];
    }
  }
  return [];
}

export function totalOf(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Json;
  for (const field of ['totalItemCount', 'totalCount', 'total', 'count']) {
    if (typeof b[field] === 'number') return b[field] as number;
  }
  return null;
}

/** Whether another page of children exists after `pageIndex`. */
export function hasMorePages(body: unknown, pageIndex: number, returned: number, pageSize: number): boolean {
  const total = totalOf(body);
  return total !== null ? (pageIndex + 1) * pageSize < total : returned === pageSize;
}

/** Content keys may come with or without dashes and in any case; compare them normalised. */
export function normalizeKey(key: string | null | undefined): string {
  return (key ?? '').replace(/-/g, '').toLowerCase();
}

/** The parent of a content node, from `GET /v1/content/{key}` (`container`). */
export function parentOf(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as Json;
  return asString(n.container) ?? asString(n.parent) ?? asString(n.parentKey);
}

/** True only when `node`'s parent is `parentKey`. Unknown or missing parents are rejected. */
export function isChildOf(node: unknown, parentKey: string): boolean {
  const parent = normalizeKey(parentOf(node));
  return parent !== '' && parent === normalizeKey(parentKey);
}

/** Compact, all-locale summary of a child's versions (drops anything without an ID or locale). */
export function summarizeVersions(raw: Json[]): VersionSummary[] {
  const out: VersionSummary[] = [];
  for (const v of raw) {
    const version = asString(v.version ?? v.id);
    const locale = asString(v.locale);
    if (!version || !locale) continue;
    out.push({
      version,
      locale,
      status: (asString(v.status) ?? '').toLowerCase(),
      displayName: asString(v.displayName),
      lastModified: asString(v.lastModified)
    });
  }
  return out;
}

export function childRecord(node: Json, rawVersions: Json[]): ChildRecord {
  return {
    key: asString(node.key) ?? '',
    contentType: asString(node.contentType),
    name: asString(node.displayName) ?? asString(node.name),
    versions: summarizeVersions(rawVersions)
  };
}

/** The record for a child whose lookup failed, so one failure doesn't break the list. */
export function errorRecord(node: Json, rateLimited: boolean): ChildRecord {
  return {
    ...childRecord(node, []),
    error: rateLimited ? 'Rate limited by the CMS. Refresh to retry.' : 'Could not load this item. Refresh to retry.'
  };
}
