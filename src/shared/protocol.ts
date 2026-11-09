// Shapes shared by the sidebar UI and the backend function.

export type Envelope<T> =
  | {ok: true; result: T}
  | {ok: false; error: string; message?: string};

export type ChildState =
  | 'draft'     // has a draft/ready version newer than the published one (or never published) -> can publish
  | 'published' // published, no newer draft
  | 'none'      // no version in this locale (see otherLocales), or the API key can't see it
  | 'error';    // the lookup failed (for example rate limited); Refresh to retry

/** One draft/ready/published version of a child, in one locale (compact form of the CMS version). */
export interface VersionSummary {
  version: string;
  locale: string;
  status: string; // lowercase: draft | ready | published
  displayName: string | null;
  lastModified: string | null;
}

/**
 * A child item with its versions in ALL locales, as returned by the backend. The UI derives the
 * per-language view (ChildItem) from it, so switching language needs no extra CMS calls.
 */
export interface ChildRecord {
  key: string;
  contentType: string | null;
  name: string | null;
  versions: VersionSummary[];
  /** Set when the lookup failed (for example rate limited). */
  error?: string;
}

/** A child as shown for one language. */
export interface ChildItem {
  key: string;
  displayName: string;
  contentType: string | null;
  locale: string;
  state: ChildState;
  /** Version to publish (newest draft/ready version), when state is 'draft'. */
  draftVersion: string | null;
  draftStatus: string | null;
  publishedVersion: string | null;
  lastModified: string | null;
  /** Locales the item has versions in, other than the shown one. */
  otherLocales: string[];
  error?: string;
}

export interface ListChildrenParams {
  key: string;
  pageIndex: number;
}

export interface ListChildrenResult {
  items: ChildRecord[];
  pageIndex: number;
  hasMore: boolean;
}

export interface PublishRequestItem {
  key: string;
  version: string;
}

export interface PublishParams {
  /** Key of the item open in the editor. Only its direct children can be published. */
  parentKey: string;
  items: PublishRequestItem[];
}

export interface PublishItemResult {
  key: string;
  version: string;
  ok: boolean;
  status: number;
  message?: string;
}

export interface PublishResult {
  results: PublishItemResult[];
}

export interface StatusResult {
  configured: boolean;
  baseUrl: string;
  clientId: string | null;
}
