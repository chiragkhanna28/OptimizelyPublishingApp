import {describe, expect, it} from 'vitest';
import {
  childRecord,
  errorRecord,
  hasMorePages,
  isChildOf,
  listOf,
  normalizeKey,
  parentOf,
  summarizeVersions,
  totalOf
} from './versions';

const KEY = 'a09341b4fa124e2aa2433cde31146ab1';

describe('listOf', () => {
  it('reads items, data, results or a bare array', () => {
    expect(listOf({items: [{a: 1}]})).toEqual([{a: 1}]);
    expect(listOf({data: [{a: 2}]})).toEqual([{a: 2}]);
    expect(listOf({results: [{a: 3}]})).toEqual([{a: 3}]);
    expect(listOf([{a: 4}])).toEqual([{a: 4}]);
  });

  it('returns [] for anything else', () => {
    expect(listOf(null)).toEqual([]);
    expect(listOf('nope')).toEqual([]);
    expect(listOf({items: 'x'})).toEqual([]);
  });
});

describe('paging', () => {
  it('uses a total count when the API gives one', () => {
    expect(totalOf({totalItemCount: 25})).toBe(25);
    expect(hasMorePages({totalItemCount: 25}, 0, 10, 10)).toBe(true);
    expect(hasMorePages({totalItemCount: 25}, 2, 5, 10)).toBe(false);
  });

  it('falls back to "a full page means there may be more"', () => {
    expect(hasMorePages({items: []}, 0, 10, 10)).toBe(true);
    expect(hasMorePages({items: []}, 0, 7, 10)).toBe(false);
  });
});

describe('summarizeVersions', () => {
  it('keeps every locale, lowercases status, accepts `version` or numeric `id`', () => {
    expect(
      summarizeVersions([
        {version: '488', locale: 'en', status: 'Published', displayName: 'Home', lastModified: '2026-11-01T10:00:00Z'},
        {id: 512, locale: 'fr', status: 'draft', displayName: 'Accueil'}
      ])
    ).toEqual([
      {version: '488', locale: 'en', status: 'published', displayName: 'Home', lastModified: '2026-11-01T10:00:00Z'},
      {version: '512', locale: 'fr', status: 'draft', displayName: 'Accueil', lastModified: null}
    ]);
  });

  it('drops versions without an ID or locale', () => {
    expect(summarizeVersions([{locale: 'en', status: 'draft'}, {version: '3', status: 'draft'}])).toEqual([]);
  });
});

describe('childRecord / errorRecord', () => {
  it('builds a record from the items node and its versions', () => {
    expect(childRecord({key: KEY, contentType: 'CKExperienceType'}, [{version: '1', locale: 'fr', status: 'draft'}]))
      .toMatchObject({key: KEY, contentType: 'CKExperienceType', name: null, versions: [{version: '1', locale: 'fr'}]});
  });

  it('marks failed lookups with a retry hint', () => {
    expect(errorRecord({key: KEY}, true).error).toBe('Rate limited by the CMS. Refresh to retry.');
    expect(errorRecord({key: KEY}, false).error).toBe('Could not load this item. Refresh to retry.');
  });
});

describe('isChildOf (publish is limited to children of the open item)', () => {
  const PARENT = '98eb33cfa7df48d1b987442c522984c8';

  it('accepts a direct child, whatever the key format', () => {
    expect(isChildOf({key: KEY, container: PARENT}, PARENT)).toBe(true);
    expect(isChildOf({key: KEY, container: PARENT.toUpperCase()}, PARENT)).toBe(true);
    expect(isChildOf({key: KEY, container: '98eb33cf-a7df-48d1-b987-442c522984c8'}, PARENT)).toBe(true);
  });

  it('rejects items under another parent', () => {
    expect(isChildOf({key: KEY, container: '0874c4b2589548e08b3cd2daab63efbe'}, PARENT)).toBe(false);
  });

  it('rejects when the parent is unknown (safe default)', () => {
    expect(isChildOf({key: KEY}, PARENT)).toBe(false);
    expect(isChildOf(null, PARENT)).toBe(false);
    expect(isChildOf({key: KEY, container: ''}, PARENT)).toBe(false);
  });

  it('reads the parent from `container`, and normalises keys', () => {
    expect(parentOf({container: PARENT})).toBe(PARENT);
    expect(normalizeKey('98EB33CF-A7DF')).toBe('98eb33cfa7df');
  });
});
