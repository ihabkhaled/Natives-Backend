import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { RosterCandidateNotFoundError } from '../errors/roster-candidate-not-found.error';
import { RosterJerseyConflictError } from '../errors/roster-jersey-conflict.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import { RosterOverrideRequiredError } from '../errors/roster-override-required.error';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import type { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterMemberStatus,
  RosterPosition,
  RosterStatus,
} from '../model/rosters.enums';
import type {
  Roster,
  RosterCandidate,
  RosterEntry,
  RosterEntryContent,
} from '../model/rosters.types';
import { AddRosterEntryUseCase } from './add-roster-entry.use-case';
import type { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const IDS = { generate: () => 'entry-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
  roles: [],
};

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

function candidate(overrides: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    membershipId: 'member-1',
    memberStatus: RosterMemberStatus.Active,
    gender: 'woman',
    jerseyNumber: 11,
    availability: null,
    selectedInSquad: true,
    ...overrides,
  };
}

function content(
  overrides: Partial<RosterEntryContent> = {},
): RosterEntryContent {
  return {
    membershipId: 'member-1',
    jerseyNumber: null,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    selectionReason: null,
    ...overrides,
  };
}

function stored(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 11,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Women,
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

function build(options: {
  roster?: Roster;
  candidate?: RosterCandidate | null;
  jerseyHolder?: RosterEntry | null;
  written?: RosterEntry;
}): {
  useCase: AddRosterEntryUseCase;
  upsert: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(options.roster ?? roster()),
  } as unknown as RosterLookupService;
  const source = {
    findCandidate: vi
      .fn()
      .mockResolvedValue(
        'candidate' in options ? options.candidate : candidate(),
      ),
  } as unknown as RosterSourceRepository;
  const upsert = vi.fn().mockResolvedValue(options.written ?? stored());
  const entries = {
    upsert,
    findByJersey: vi.fn().mockResolvedValue(options.jerseyHolder ?? null),
  } as unknown as RosterEntryRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new AddRosterEntryUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup,
      source,
      entries,
      audit as unknown as AuditRecorderService,
    ),
    upsert,
    audit,
  };
}

describe('AddRosterEntryUseCase', () => {
  it('adds an unflagged candidate with no override recorded', async () => {
    const { useCase, upsert, audit } = build({});
    const entry = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      content: content(),
      override: null,
    });
    expect(entry.constraintOverridden).toBe(false);
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      jerseyNumber: 11,
      genderBucket: RosterGenderBucket.Women,
      constraintOverridden: false,
    });
    expect(audit.record.mock.calls[0]?.[1].action).toBe('roster.entry.added');
  });

  it('refuses a flagged candidate with no override', async () => {
    const { useCase, upsert } = build({
      candidate: candidate({ memberStatus: RosterMemberStatus.Suspended }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        content: content(),
        override: null,
      }),
    ).rejects.toBeInstanceOf(RosterOverrideRequiredError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('records the override evidence and audits it distinctly', async () => {
    const { useCase, upsert, audit } = build({
      candidate: candidate({
        availability: RosterAvailabilityStatus.Unavailable,
      }),
      written: stored({
        constraintOverridden: true,
        overrideReason: 'travelling but confirmed',
        overriddenBy: 'user-1',
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      content: content(),
      override: { overrideReason: 'travelling but confirmed' },
    });
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      constraintOverridden: true,
      overrideReason: 'travelling but confirmed',
      overriddenBy: 'user-1',
    });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'roster.entry.overridden',
      diff: { flags: 'declared_unavailable', overridden: true },
    });
  });

  it('flags a non-squad member only when the roster was drawn from a squad', async () => {
    const squadBound = build({
      roster: roster({ squadId: 'squad-1' }),
      candidate: candidate({ selectedInSquad: false }),
    });
    await expect(
      squadBound.useCase.execute(ACTOR, 'team-1', 'roster-1', {
        content: content(),
        override: null,
      }),
    ).rejects.toBeInstanceOf(RosterOverrideRequiredError);
    const freeForm = build({
      candidate: candidate({ selectedInSquad: false }),
    });
    await expect(
      freeForm.useCase.execute(ACTOR, 'team-1', 'roster-1', {
        content: content(),
        override: null,
      }),
    ).resolves.toBeDefined();
  });

  it('refuses to change a frozen roster', async () => {
    for (const status of [
      RosterStatus.Locked,
      RosterStatus.Revised,
      RosterStatus.Archived,
    ]) {
      const { useCase } = build({ roster: roster({ status }) });
      await expect(
        useCase.execute(ACTOR, 'team-1', 'roster-1', {
          content: content(),
          override: null,
        }),
      ).rejects.toBeInstanceOf(RosterLockedError);
    }
  });

  it('refuses a membership that is not in this team and season', async () => {
    const { useCase } = build({ candidate: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        content: content(),
        override: null,
      }),
    ).rejects.toBeInstanceOf(RosterCandidateNotFoundError);
  });

  it('refuses a jersey another selected player already wears', async () => {
    const { useCase, upsert } = build({
      jerseyHolder: stored({ membershipId: 'member-2' }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        content: content({ jerseyNumber: 11 }),
        override: null,
      }),
    ).rejects.toBeInstanceOf(RosterJerseyConflictError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('lets a player keep the jersey they already hold', async () => {
    const { useCase, upsert } = build({
      jerseyHolder: stored({ membershipId: 'member-1' }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      content: content({ jerseyNumber: 11 }),
      override: null,
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('skips the jersey check entirely when no number is assigned', async () => {
    const { useCase, upsert } = build({
      candidate: candidate({ jerseyNumber: null }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      content: content(),
      override: null,
    });
    expect(upsert.mock.calls[0]?.[1].jerseyNumber).toBeNull();
  });
});
