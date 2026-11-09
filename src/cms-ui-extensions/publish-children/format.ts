import type {ChildItem} from '@shared/protocol';

export type Filter = 'all' | 'draft' | 'live';

export type BadgeIntent = 'warning' | 'success' | 'neutral' | 'danger' | 'information';

export function isPublishable(child: ChildItem): boolean {
  return child.state === 'draft' && !!child.draftVersion;
}

export function badgeFor(child: ChildItem): {label: string; intent: BadgeIntent} {
  switch (child.state) {
  case 'draft':
    return child.draftStatus === 'ready' ? {label: 'Ready', intent: 'information'} : {label: 'Draft', intent: 'warning'};
  case 'published':
    return {label: 'Live', intent: 'success'};
  case 'error':
    return {label: 'Error', intent: 'danger'};
  default:
    return child.otherLocales.length > 0
      ? {label: `Only ${child.otherLocales.join(', ').toUpperCase()}`, intent: 'neutral'}
      : {label: 'No version', intent: 'neutral'};
  }
}

export function matchesFilter(child: ChildItem, filter: Filter): boolean {
  if (filter === 'draft') return isPublishable(child);
  if (filter === 'live') return child.state === 'published';
  return true;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", or a date. */
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(then).toLocaleDateString();
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
