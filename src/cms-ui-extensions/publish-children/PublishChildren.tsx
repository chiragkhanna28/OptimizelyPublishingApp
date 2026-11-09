import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  Badge,
  Banner,
  Box,
  Button,
  Checkbox,
  Group,
  Progress,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Text,
  toaster
} from '@optiaxiom/react';
import {IconArrowsRotate, IconFolderOpen, IconFolderTree, IconLanguage} from '@optiaxiom/icons';
import type {ContentState, ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import {PUBLISH_BATCH_SIZE} from '@shared/constants';
import {collectLocales, viewForLocale} from '@shared/classify';
import type {
  ChildRecord,
  ListChildrenResult,
  PublishItemResult,
  PublishResult,
  StatusResult
} from '@shared/protocol';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackendError, callBackend} from './backend';
import {ChildRow} from './ChildRow';
import {Filter, isPublishable, matchesFilter, plural} from './format';

interface Target {
  key: string;
  locale: string;
}

interface Failure extends PublishItemResult {
  name: string;
}

const SEARCH_THRESHOLD = 6;

function errorText(error: unknown): string {
  if (error instanceof BackendError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function PublishChildren({context}: {context: ExtensionContext}) {
  const [target, setTarget] = useState<Target | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  // Children with their versions in ALL languages; `locale` picks which language is shown.
  const [records, setRecords] = useState<ChildRecord[]>([]);
  const [locale, setLocale] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{done: number; total: number} | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const loadToken = useRef(0);
  const failuresRef = useRef<HTMLDivElement>(null);

  // Bring the failure details into view: after publishing the editor is usually scrolled down.
  useEffect(() => {
    if (failures.length > 0) failuresRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, [failures]);

  // --- current content from the CMS ---------------------------------------------------------
  useEffect(() => {
    void context.extension.setReady();
    const apply = (state: ContentState | null) => {
      const key = state?.key;
      const locale = state?.locale;
      if (!key || !locale) return; // ignore empty events
      setTarget((prev) => (prev && prev.key === key && prev.locale === locale ? prev : {key, locale}));
    };
    void context.content.get().then(apply).catch(() => undefined);
    const unsubscribe = context.content.subscribe(apply);
    void callBackend<StatusResult>(context, 'status')
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(null));
    return unsubscribe;
  }, [context]);

  // --- load children ------------------------------------------------------------------------
  const load = useCallback(
    async (t: Target, page: number) => {
      const token = ++loadToken.current;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await callBackend<ListChildrenResult>(context, 'listChildren', {key: t.key, pageIndex: page});
        if (token !== loadToken.current) return;
        setRecords((prev) => (page === 0 ? res.items : [...prev, ...res.items]));
        setPageIndex(page);
        setHasMore(res.hasMore);
        setUpdatedAt(new Date());
        const failed = res.items.filter((r) => r.error).length;
        if (failed > 0) {
          setLoadError(`${plural(failed, 'item')} could not be loaded (the CMS may be busy). Refresh to retry.`);
        }
      } catch (error) {
        if (token === loadToken.current) setLoadError(errorText(error));
      } finally {
        if (token === loadToken.current) setLoading(false);
      }
    },
    [context]
  );

  useEffect(() => {
    setRecords([]);
    setSelected(new Set());
    setFailures([]);
    setHasMore(false);
    setQuery('');
    setFilter('all');
    // Default to the language of the content version the CMS has open. Note: when the page
    // doesn't exist in the editor's language, the CMS opens (and reports) another language,
    // so the editor can switch with the language control.
    setLocale(target?.locale ?? null);
    if (target) void load(target, 0);
  }, [target, load]);

  const changeLocale = useCallback((next: string) => {
    if (!next) return;
    setLocale(next);
    setSelected(new Set()); // versions differ per language
    setFailures([]);
    setFilter('all');
  }, []);

  // --- derived lists ------------------------------------------------------------------------
  const locales = useMemo(() => collectLocales(records, target?.locale), [records, target?.locale]);
  const children = useMemo(
    () => (locale ? records.map((r) => viewForLocale(r, locale)) : []),
    [records, locale]
  );

  const counts = useMemo(
    () => ({
      all: children.length,
      draft: children.filter(isPublishable).length,
      live: children.filter((c) => c.state === 'published').length
    }),
    [children]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return children.filter((c) => matchesFilter(c, filter) && (!q || c.displayName.toLowerCase().includes(q)));
  }, [children, filter, query]);

  const visibleDrafts = visible.filter(isPublishable);
  const selectedItems = children.filter((c) => isPublishable(c) && selected.has(c.key));
  const allVisibleSelected = visibleDrafts.length > 0 && visibleDrafts.every((c) => selected.has(c.key));
  const someVisibleSelected = visibleDrafts.some((c) => selected.has(c.key));
  const publishing = progress !== null;

  const toggle = useCallback(
    (key: string, checked: boolean) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) next.add(key);
        else next.delete(key);
        return next;
      }),
    []
  );

  const toggleVisible = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleDrafts) {
        if (checked) next.add(c.key);
        else next.delete(c.key);
      }
      return next;
    });

  // --- publish ------------------------------------------------------------------------------
  const publish = useCallback(async () => {
    if (!target || selectedItems.length === 0) return;
    const queue = selectedItems.map((c) => ({key: c.key, version: c.draftVersion as string}));
    const names = new Map(selectedItems.map((c) => [c.key, c.displayName]));
    setConfirmOpen(false);
    setFailures([]);
    setProgress({done: 0, total: queue.length});

    const results: PublishItemResult[] = [];
    for (let i = 0; i < queue.length; i += PUBLISH_BATCH_SIZE) {
      const batch = queue.slice(i, i + PUBLISH_BATCH_SIZE);
      try {
        // parentKey lets the backend refuse anything that isn't a child of the open item.
        const res = await callBackend<PublishResult>(context, 'publish', {parentKey: target.key, items: batch});
        results.push(...res.results);
      } catch (error) {
        results.push(...batch.map((b) => ({...b, ok: false, status: 0, message: errorText(error)})));
      }
      setProgress({done: Math.min(i + batch.length, queue.length), total: queue.length});
    }

    const failed = results.filter((r) => !r.ok).map((r) => ({...r, name: names.get(r.key) ?? r.key}));
    const succeeded = results.length - failed.length;
    setFailures(failed);
    setProgress(null);
    setSelected(new Set(failed.map((f) => f.key))); // keep failed ones selected for a retry

    // Notification popup (Axiom toast, inside the extension frame).
    if (failed.length === 0) {
      toaster.create(`Published ${plural(succeeded, 'item')}`, {intent: 'success'});
    } else if (succeeded > 0) {
      toaster.create(`Published ${succeeded} of ${results.length}. ${failed.length} failed.`, {intent: 'warning'});
    } else {
      toaster.create(`Publishing failed for ${plural(failed.length, 'item')}`, {intent: 'danger'});
    }

    await load(target, 0);
  }, [context, load, selectedItems, target]);

  // --- render -------------------------------------------------------------------------------
  const firstLoad = loading && children.length === 0;
  const showFooter = !!target && (counts.draft > 0 || publishing);

  return (
    <Box display="flex" flexDirection="column" style={{minHeight: '100vh'}}>
      <Box flex="1" p="12">
        <Group flexDirection="column" gap="12">
          {/* Header */}
          <Group alignItems="center" gap="8" justifyContent="space-between">
            <Group alignItems="center" gap="8" style={{minWidth: 0}}>
              <Box color="fg.secondary" display="flex"><IconFolderTree style={{width: 20, height: 20}} /></Box>
              <Text fontSize="lg" fontWeight="600">Child items</Text>
              {locale && <Badge intent="neutral" variant="subtle">{locale.toUpperCase()}</Badge>}
            </Group>
            {target && (
              <Button
                appearance="subtle"
                aria-label="Refresh"
                disabled={loading || publishing}
                icon={<IconArrowsRotate />}
                onClick={() => void load(target, 0)}
                size="sm"
              />
            )}
          </Group>

          {/* Language: the SDK only reports the language of the open version, so let the editor choose. */}
          {locale && locales.length > 1 && (
            <Group flexDirection="column" gap="4">
              <Group alignItems="center" gap="8">
                <Box color="fg.secondary" display="flex" style={{flexShrink: 0}}>
                  <IconLanguage style={{width: 18, height: 18}} />
                </Box>
                <Text color="fg.secondary" fontSize="sm" style={{flexShrink: 0}}>Language</Text>
                <Box style={{minWidth: 0, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none'}}>
                <SegmentedControl
                  onValueChange={(value: string) => changeLocale(value)}
                  size="sm"
                  style={{flexWrap: 'nowrap', width: 'max-content'}}
                  type="single"
                  value={locale}
                >
                  {locales.map((l) => (
                    <SegmentedControlItem disabled={publishing} key={l} value={l}>
                      {l.toUpperCase()}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
                </Box>
              </Group>
              {target && locale !== target.locale && (
                <Text color="fg.secondary" fontSize="xs">
                  Showing the {locale.toUpperCase()} versions of the children. The open item is in{' '}
                  {target.locale.toUpperCase()}.
                </Text>
              )}
            </Group>
          )}

          {configured === false && (
            <Banner intent="warning">
              No CMS API key is configured. Add the Client ID and Secret in the app settings (OCP App Directory).
            </Banner>
          )}

          {loadError && (
            <Banner intent="danger" onDismiss={() => setLoadError(null)}>
              {loadError}
            </Banner>
          )}

          {failures.length > 0 && (
            <Banner intent="danger" onDismiss={() => setFailures([])} ref={failuresRef}>
              <Group flexDirection="column" gap="4">
                <Text fontWeight="600">{plural(failures.length, 'item')} could not be published</Text>
                {failures.map((f) => (
                  <Text fontSize="sm" key={`${f.key}@${f.version}`}>
                    {f.name}: {f.message ?? `HTTP ${f.status}`}
                  </Text>
                ))}
                <Text fontSize="sm">They are still selected, so you can try again.</Text>
              </Group>
            </Banner>
          )}

          {/* No content selected */}
          {!target && (
            <EmptyState text="Open a page or folder in the content tree to see its child items." />
          )}

          {/* Filters */}
          {target && children.length > 0 && (
            <Group flexDirection="column" gap="8">
              <SegmentedControl
                onValueChange={(value: string) => value && setFilter(value as Filter)}
                size="sm"
                type="single"
                value={filter}
                w="full"
              >
                <SegmentedControlItem flex="1" value="all">All {counts.all}</SegmentedControlItem>
                <SegmentedControlItem flex="1" value="draft">Drafts {counts.draft}</SegmentedControlItem>
                <SegmentedControlItem flex="1" value="live">Live {counts.live}</SegmentedControlItem>
              </SegmentedControl>
              {children.length > SEARCH_THRESHOLD && (
                <SearchInput
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name"
                  value={query}
                />
              )}
            </Group>
          )}

          {/* Select all */}
          {visibleDrafts.length > 0 && !publishing && (
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={toggleVisible}
            >
              Select all drafts ({visibleDrafts.length})
            </Checkbox>
          )}

          {/* List */}
          {firstLoad && (
            <Group flexDirection="column" gap="8">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{display: 'block', height: 52, width: '100%'}} />
              ))}
            </Group>
          )}

          {visible.length > 0 && (
            <Group flexDirection="column" gap="6">
              {visible.map((child) => (
                <ChildRow
                  child={child}
                  disabled={publishing}
                  key={child.key}
                  onToggle={toggle}
                  selected={selected.has(child.key)}
                />
              ))}
            </Group>
          )}

          {target && !loading && children.length === 0 && !loadError && (
            <EmptyState text="This item has no child items." />
          )}

          {children.length > 0 && visible.length === 0 && (
            <Text color="fg.secondary" fontSize="sm" textAlign="center">
              Nothing matches this filter.
            </Text>
          )}

          {hasMore && target && (
            <Button
              appearance="subtle"
              disabled={loading || publishing}
              loading={loading && children.length > 0}
              onClick={() => void load(target, pageIndex + 1)}
              size="sm"
              w="full"
            >
              Load more
            </Button>
          )}

          {updatedAt && (
            <Text color="fg.tertiary" fontSize="xs" textAlign="center">
              Updated {updatedAt.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </Text>
          )}
        </Group>
      </Box>

      {/* Sticky action bar */}
      {showFooter && (
        <Box
          bg="bg.default"
          borderColor="border.default"
          borderT="1"
          p="12"
          shadow="md"
          style={{bottom: 0, position: 'sticky'}}
        >
          {publishing && progress ? (
            <Group flexDirection="column" gap="6">
              <Text fontSize="sm" fontWeight="500">
                Publishing {progress.done} of {progress.total}…
              </Text>
              <Progress max={progress.total} value={progress.done} />
            </Group>
          ) : (
            <Group alignItems="center" gap="8" justifyContent="space-between">
              <Text color={selectedItems.length ? 'fg.default' : 'fg.secondary'} fontSize="sm">
                {selectedItems.length ? `${selectedItems.length} selected` : 'Select drafts to publish'}
              </Text>
              <Group gap="6">
                {selectedItems.length > 0 && (
                  <Button appearance="subtle" onClick={() => setSelected(new Set())} size="sm">
                    Clear
                  </Button>
                )}
                <Button
                  appearance="primary"
                  disabled={selectedItems.length === 0 || loading}
                  onClick={() => setConfirmOpen(true)}
                  size="sm"
                >
                  Publish{selectedItems.length ? ` (${selectedItems.length})` : ''}
                </Button>
              </Group>
            </Group>
          )}
        </Box>
      )}

      {/* Confirmation */}
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>Publish {plural(selectedItems.length, 'item')}?</AlertDialogHeader>
          <AlertDialogBody>
            <Group flexDirection="column" gap="8">
              <Text>Their latest drafts go live now:</Text>
              <Box asChild pl="16">
                <ul style={{listStyle: 'disc', margin: 0}}>
                  {selectedItems.slice(0, 5).map((c) => (
                    <li key={c.key}><Text asChild fontWeight="500"><span>{c.displayName}</span></Text></li>
                  ))}
                  {selectedItems.length > 5 && (
                    <li><Text asChild color="fg.secondary"><span>and {selectedItems.length - 5} more</span></Text></li>
                  )}
                </ul>
              </Box>
              <Text color="fg.secondary" fontSize="sm">
                Publishing uses the app&apos;s CMS API key, so the version history shows the API key as the publisher.
              </Text>
            </Group>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction appearance="primary" onClick={() => void publish()}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}

function EmptyState({text}: {text: string}) {
  return (
    <Group alignItems="center" flexDirection="column" gap="8" py="24">
      <Box color="fg.tertiary" display="flex"><IconFolderOpen style={{width: 32, height: 32}} /></Box>
      <Text color="fg.secondary" fontSize="sm" textAlign="center">{text}</Text>
    </Group>
  );
}
