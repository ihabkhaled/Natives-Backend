import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { RosterConstraintError } from '../errors/roster-constraint.error';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import {
  ConstraintCode,
  ConstraintSeverity,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
} from '../model/rosters.enums';
import type { Roster, RosterEntry } from '../model/rosters.types';
import type { RosterLookupService } from './roster-lookup.service';
import { RosterValidationService } from './roster-validation.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');

function roster(overrides: Partial<Roster> = {}): Roster {
  return {
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    squadId: null,
    sourceRosterId: null,
    supersedesRosterId: null,
    currentSnapshotId: null,
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    status: RosterStatus.Draft,
    division: RosterDivision.Mixed,
    minSize: 1,
    maxSize: 30,
    minWomen: null,
    requireCaptain: false,
    policyVersion: 'roster-constraints-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: null,
    publishedAt: null,
    lockedBy: null,
    lockedAt: null,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function entry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Men,
    status: RosterEntryStatus.Selected,
    availability: null,
    selectionReason: null,
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-1',
    removedBy: null,
    removedAt: null,
    removalReason: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function build(
  entries: RosterEntry[],
  target: Roster = roster(),
): RosterValidationService {
  const lookup = {
    require: vi.fn().mockResolvedValue(target),
  } as unknown as RosterLookupService;
  const repository = {
    listActive: vi.fn().mockResolvedValue(entries),
  } as unknown as RosterEntryRepository;
  return new RosterValidationService(UOW, lookup, repository);
}

describe('RosterValidationService', () => {
  it('previews a satisfied roster as publishable, citing the rule version', async () => {
    const report = await build([entry()]).preview('team-1', 'roster-1');
    expect(report).toMatchObject({
      rosterId: 'roster-1',
      policyVersion: 'roster-constraints-v1',
      status: RosterStatus.Draft,
      publishable: true,
      violations: [],
    });
    expect(report.composition.selected).toBe(1);
  });

  it('previews a blocking violation without throwing', async () => {
    const report = await build([entry()], roster({ minSize: 7 })).preview(
      'team-1',
      'roster-1',
    );
    expect(report.publishable).toBe(false);
    expect(report.violations[0]).toEqual({
      code: ConstraintCode.MinSize,
      severity: ConstraintSeverity.Error,
      count: 1,
    });
  });

  it('reports advisory warnings as publishable', async () => {
    const report = await build([entry({ jerseyNumber: null })]).preview(
      'team-1',
      'roster-1',
    );
    expect(report.publishable).toBe(true);
    expect(report.violations[0]?.severity).toBe(ConstraintSeverity.Warning);
  });

  it('lets a satisfied roster freeze', async () => {
    const service = build([entry()]);
    await expect(
      service.assertPublishable(TX, roster()),
    ).resolves.toMatchObject({ publishable: true });
  });

  it('refuses to freeze a roster that still breaks a blocking rule', async () => {
    const service = build([entry()]);
    await expect(
      service.assertPublishable(TX, roster({ requireCaptain: true })),
    ).rejects.toBeInstanceOf(RosterConstraintError);
  });

  it('measures the roster’s own stored constraints, not the request’s', async () => {
    const service = build([
      entry(),
      entry({ entryId: 'entry-2', membershipId: 'member-2', jerseyNumber: 8 }),
    ]);
    const report = await service.evaluate(TX, roster({ maxSize: 1 }));
    expect(report.violations[0]?.code).toBe(ConstraintCode.MaxSize);
  });
});
