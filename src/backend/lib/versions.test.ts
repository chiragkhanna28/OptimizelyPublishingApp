import {describe, expect, it} from 'vitest';
import {childRecord, errorRecord, hasMorePages, listOf, summarizeVersions, totalOf} from './versions';

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
