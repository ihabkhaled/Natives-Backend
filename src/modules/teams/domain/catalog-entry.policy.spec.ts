import { describe, expect, it } from 'vitest';

import { isCatalogEntryReferenced } from './catalog-entry.policy';

describe('catalog-entry.policy', () => {
  it('reports an entry with references as in use', () => {
    expect(isCatalogEntryReferenced(1)).toBe(true);
    expect(isCatalogEntryReferenced(42)).toBe(true);
  });

  it('reports an entry with no references as not in use', () => {
    expect(isCatalogEntryReferenced(0)).toBe(false);
  });
});
