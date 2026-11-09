import type {ChildItem, ChildRecord, VersionSummary} from './protocol';

/*
 * Works out a child's publish state for ONE language from its versions in all languages.
 * Shared by the UI (language switcher) and unit tests. Pure: no I/O.
 */

const PENDING_STATUSES = new Set(['draft', 'ready']);

/** Version IDs are instance-wide and increasing. Compare numerically when possible. */
export function newer(a: string, b: string): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na > nb;
  return a > b;
}

export function newestOf<T extends {version: string}>(versions: T[]): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (!best || newer(v.version, best.version)) best = v;
  }
  return best;
}

export function shortKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 8)}…` : key;
}

/** All locales that appear in the records, sorted, with `preferred` first when given. */
export function collectLocales(records: ChildRecord[], preferred?: string | null): string[] {
  const set = new Set<string>();
  for (const r of records) for (const v of r.versions) if (v.locale) set.add(v.locale);
  if (preferred) set.add(preferred);
  return [...set].sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : a.localeCompare(b)));
}

/**
 * The child as shown for `locale`.
 * Publishable ("draft") = has a draft/ready version newer than the published one, or was never published.
 */
export function viewForLocale(record: ChildRecord, locale: string): ChildItem {
  const fallbackName = record.name ?? `Item ${shortKey(record.key)}`;
  const otherLocales = [...new Set(record.versions.map((v) => v.locale).filter((l) => l && l !== locale))].sort();

  if (record.error) {
    return {
      key: record.key,
      displayName: fallbackName,
      contentType: record.contentType,
      locale,
      state: 'error',
      draftVersion: null,
      draftStatus: null,
      publishedVersion: null,
      lastModified: null,
      otherLocales: [],
      error: record.error
    };
  }

  const inLocale = record.versions.filter((v) => v.locale === locale);
  const published = newestOf(inLocale.filter((v) => v.status === 'published'));
  const pending = newestOf(inLocale.filter((v) => PENDING_STATUSES.has(v.status)));
  const hasNewerDraft = !!pending && (!published || newer(pending.version, published.version));

  // Name: this language's version first, then any language, then the node's name.
  const shown: VersionSummary | null = (hasNewerDraft ? pending : published) ?? pending ?? published;
  const anyName = shown?.displayName ?? newestOf(record.versions)?.displayName ?? null;

  return {
    key: record.key,
    displayName: anyName ?? fallbackName,
    contentType: record.contentType,
    locale,
    state: hasNewerDraft ? 'draft' : published ? 'published' : 'none',
    draftVersion: hasNewerDraft && pending ? pending.version : null,
    draftStatus: hasNewerDraft && pending ? pending.status : null,
    publishedVersion: published?.version ?? null,
    lastModified: shown?.lastModified ?? null,
    otherLocales
  };
}
