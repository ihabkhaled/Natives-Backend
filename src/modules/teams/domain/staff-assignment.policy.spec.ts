import { describe, expect, it } from 'vitest';

import { CatalogName, ResourceStatus } from '../model/teams.enums';
import type { CatalogEntry } from '../model/teams.types';
import { isAssignableStaffTitle } from './staff-assignment.policy';

function buildEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'entry-1',
    teamId: 'team-1',
    catalog: CatalogName.StaffTitle,
    key: 'coach',
    label: 'Coach',
    sortOrder: 0,
    metadata: {},
    referenceCount: 0,
    status: ResourceStatus.Active,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
    ...overrides,
  };
}

describe('isAssignableStaffTitle', () => {
  it('accepts an active staff_title catalog entry', () => {
    expect(isAssignableStaffTitle(buildEntry())).toBe(true);
  });

  it('rejects an entry from a different catalog', () => {
    expect(
      isAssignableStaffTitle(buildEntry({ catalog: CatalogName.Position })),
    ).toBe(false);
  });

  it('rejects an archived staff_title entry', () => {
    expect(
      isAssignableStaffTitle(buildEntry({ status: ResourceStatus.Archived })),
    ).toBe(false);
  });
});
