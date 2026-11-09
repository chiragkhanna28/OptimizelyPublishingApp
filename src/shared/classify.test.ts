import {describe, expect, it} from 'vitest';
import {collectLocales, newer, newestOf, viewForLocale} from './classify';
import type {ChildRecord, VersionSummary} from './protocol';

const KEY = 'a09341b4fa124e2aa2433cde31146ab1';

const v = (version: string, locale: string, status: string, displayName: string | null = null): VersionSummary => ({
  version,
  locale,
  status,
  displayName,
  lastModified: null
});

const record = (versions: VersionSummary[], extra: Partial<ChildRecord> = {}): ChildRecord => ({
  key: KEY,
  contentType: 'CKExperienceType',
  name: null,
  versions,
  ...extra
});

describe('newer / newestOf', () => {
  it('compares version IDs numerically, not as text', () => {
    expect(newer('486', '472')).toBe(true);
    expect(newer('99', '100')).toBe(false);
  });

  it('picks the highest version', () => {
    expect(newestOf([v('5', 'en', 'draft'), v('12', 'en', 'draft'), v('9', 'en', 'draft')])?.version).toBe('12');
    expect(newestOf([])).toBeNull();
  });
});

describe('viewForLocale', () => {
  it('marks a draft newer than the published version as publishable', () => {
    const child = viewForLocale(record([v('488', 'en', 'published', 'Old'), v('489', 'en', 'draft', 'TestPage2')]), 'en');
    expect(child).toMatchObject({state: 'draft', draftVersion: '489', publishedVersion: '488', displayName: 'TestPage2'});
  });

  it('reports "ready to publish" drafts as ready', () => {
    const child = viewForLocale(record([v('10', 'en', 'ready')]), 'en');
    expect(child).toMatchObject({state: 'draft', draftStatus: 'ready'});
  });

  it('ignores a stale draft older than the published version', () => {
    const child = viewForLocale(record([v('300', 'en', 'draft'), v('400', 'en', 'published', 'Live')]), 'en');
    expect(child).toMatchObject({state: 'published', draftVersion: null, publishedVersion: '400'});
  });

  it('treats a never-published item with a draft as publishable', () => {
    expect(viewForLocale(record([v('7', 'en', 'draft')]), 'en')).toMatchObject({state: 'draft', draftVersion: '7'});
  });

  // The CMS case from testing: the open page exists only in EN, the child has an
  // unpublished FR draft and a published EN version.
  describe('per language (FR editing context)', () => {
    const child = record([v('420', 'en', 'published', 'TestingCKJUI2'), v('530', 'fr', 'draft', 'TestingCKJUI2 FR')]);

    it('is Live in EN', () => {
      expect(viewForLocale(child, 'en')).toMatchObject({state: 'published', draftVersion: null, otherLocales: ['fr']});
    });

    it('is a publishable Draft in FR, publishing the FR version', () => {
      expect(viewForLocale(child, 'fr')).toMatchObject({
        state: 'draft',
        draftVersion: '530',
        displayName: 'TestingCKJUI2 FR',
        otherLocales: ['en']
      });
    });

    it('shows "only in other languages" where it has no version', () => {
      expect(viewForLocale(child, 'de')).toMatchObject({state: 'none', otherLocales: ['en', 'fr'], displayName: 'TestingCKJUI2 FR'});
    });
  });

  it('falls back to a short key when no name exists anywhere', () => {
    expect(viewForLocale(record([]), 'en')).toMatchObject({state: 'none', displayName: 'Item a09341b4…'});
  });

  it('shows failed lookups as errors in every language', () => {
    expect(viewForLocale(record([], {error: 'Rate limited'}), 'fr')).toMatchObject({state: 'error', error: 'Rate limited'});
  });
});

describe('collectLocales', () => {
  it('lists every language found, the open item\'s language first', () => {
    const records = [record([v('1', 'fr', 'draft'), v('2', 'en', 'published')]), record([v('3', 'de', 'draft')])];
    expect(collectLocales(records, 'en')).toEqual(['en', 'de', 'fr']);
    expect(collectLocales([], 'en')).toEqual(['en']);
  });
});
