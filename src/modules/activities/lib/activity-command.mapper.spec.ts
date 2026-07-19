import { describe, expect, it } from 'vitest';

import { EvidenceKind } from '../model/activity.enums';
import {
  toBuddyMembershipIds,
  toEvidenceItems,
  toSubmissionContent,
} from './activity-command.mapper';

describe('activity-command.mapper', () => {
  it('normalises full submission content', () => {
    expect(
      toSubmissionContent({
        activityTypeId: 'type-1',
        seasonId: 'season-1',
        performedOn: '2024-05-30',
        durationMinutes: 60,
        quantity: 5,
        notes: 'note',
      }),
    ).toEqual({
      activityTypeId: 'type-1',
      seasonId: 'season-1',
      performedOn: '2024-05-30',
      durationMinutes: 60,
      quantity: 5,
      notes: 'note',
    });
  });

  it('defaults omitted optional content to null (null-not-zero)', () => {
    expect(
      toSubmissionContent({
        activityTypeId: 'type-1',
        performedOn: '2024-05-30',
      }),
    ).toEqual({
      activityTypeId: 'type-1',
      seasonId: null,
      performedOn: '2024-05-30',
      durationMinutes: null,
      quantity: null,
      notes: null,
    });
  });

  it('normalises evidence items and defaults undefined to an empty list', () => {
    expect(toEvidenceItems(undefined)).toEqual([]);
    expect(
      toEvidenceItems([
        { kind: EvidenceKind.Link, storageReference: 'ref' },
        {
          kind: EvidenceKind.File,
          storageReference: 'ref2',
          contentType: 'image/png',
          byteSize: 10,
          description: 'proof',
        },
      ]),
    ).toEqual([
      {
        kind: EvidenceKind.Link,
        storageReference: 'ref',
        contentType: null,
        byteSize: null,
        description: null,
      },
      {
        kind: EvidenceKind.File,
        storageReference: 'ref2',
        contentType: 'image/png',
        byteSize: 10,
        description: 'proof',
      },
    ]);
  });

  it('defaults omitted buddy ids to an empty list', () => {
    expect(toBuddyMembershipIds(undefined)).toEqual([]);
    expect(toBuddyMembershipIds(['a', 'b'])).toEqual(['a', 'b']);
  });
});
