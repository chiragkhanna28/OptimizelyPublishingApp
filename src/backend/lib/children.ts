import {CHILDREN_PAGE_SIZE} from '@shared/constants';
import type {ChildRecord, ListChildrenResult, PublishItemResult, PublishRequestItem} from '@shared/protocol';
import {logger} from '@zaiusinc/app-sdk';
import {CmsError, cmsFetch, cmsGet, mapLimit} from './cmsApi';
import {asString, childRecord, errorRecord, hasMorePages, Json, listOf} from './versions';

/*
 * CMS (SaaS) REST API v1 endpoints used here:
 *   GET  /v1/content/{key}/items                       -> child content of a node (paged)
 *   GET  /v1/content/{key}/versions?statuses=..        -> versions of one item (all locales)
 *   POST /v1/content/{key}/versions/{version}:publish  -> publish one version
 *        https://docs.optimizely.com/cms-saas/api/publish-content-version
 */

// Low on purpose: the CMS API answers HTTP 429 when we fan out too widely.
const LOOKUP_CONCURRENCY = 2;

const enc = encodeURIComponent;

/**
 * One call per child for its versions in ALL locales (no `locales` filter). The UI derives the
 * per-language state, so switching language needs no extra calls. Never throws: one failing
 * child (for example rate limited) must not fail the whole page.
 */
async function describeChild(node: Json): Promise<ChildRecord> {
  const key = asString(node.key) ?? '';
  try {
    const body = await cmsGet<unknown>(`/v1/content/${enc(key)}/versions?statuses=draft,ready,published&pageSize=100`);
    return childRecord(node, listOf(body));
  } catch (error) {
    logger.warn('Child lookup failed', key, error instanceof Error ? error.message : error);
    return errorRecord(node, error instanceof CmsError && error.code === 'rate_limited');
  }
}

export async function listChildren(key: string, pageIndex: number): Promise<ListChildrenResult> {
  const body = await cmsGet<unknown>(`/v1/content/${enc(key)}/items?pageIndex=${pageIndex}&pageSize=${CHILDREN_PAGE_SIZE}`);
  const nodes = listOf(body).filter((n) => asString(n.key));
  const items = await mapLimit(nodes, LOOKUP_CONCURRENCY, describeChild);
  return {items, pageIndex, hasMore: hasMorePages(body, pageIndex, nodes.length, CHILDREN_PAGE_SIZE)};
}

export async function publishVersions(items: PublishRequestItem[]): Promise<PublishItemResult[]> {
  // Sequential on purpose: small batches, gentle on the rate limit, easy per-item results.
  const results: PublishItemResult[] = [];
  for (const {key, version} of items) {
    try {
      const res = await cmsFetch<Json>('POST', `/v1/content/${enc(key)}/versions/${enc(version)}:publish`, {});
      const ok = res.status >= 200 && res.status < 300;
      const detail = res.body && (asString(res.body.detail) ?? asString(res.body.title) ?? asString(res.body.message));
      results.push({key, version, ok, status: res.status, message: ok ? undefined : detail ?? res.text.slice(0, 300)});
    } catch (error) {
      results.push({key, version, ok: false, status: 0, message: error instanceof Error ? error.message : String(error)});
    }
  }
  return results;
}
