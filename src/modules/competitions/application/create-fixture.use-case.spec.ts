import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureScheduleError } from '../errors/fixture-schedule.error';
import { MatchSide } from '../model/competitions.enums';
import type {
  Competition,
  CreateFixtureCommand,
  Fixture,
} from '../model/competitions.types';
import { CreateFixtureUseCase } from './create-fixture.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function competition(
  startsOn: string | null,
  endsOn: string | null,
): Competition {
  return {
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    name: 'Cairo League',
    competitionType: 'league' as never,
    status: 'published' as never,
    genderDivision: null,
    organizerName: null,
    externalRef: null,
    startsOn,
    endsOn,
    description: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    publishedBy: 'coach',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function fixture(): Fixture {
  return {
    fixtureId: 'fixture-1',
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    stageId: null,
    roundId: null,
    opponentId: 'opp-1',
    venueId: null,
    homeAway: MatchSide.Home,
    scheduledAt: new Date('2026-01-15T18:30:00.000Z'),
    status: 'scheduled' as never,
    rescheduleCount: 0,
    previousScheduledAt: null,
    rescheduleReason: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    rescheduledAt: null,
    finalizedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function command(): CreateFixtureCommand {
  return {
    content: {
      opponentId: 'opp-1',
      stageId: null,
      roundId: null,
      venueId: null,
      homeAway: MatchSide.Home,
      scheduledAt: '2026-01-15T18:30:00.000Z',
    },
  };
}

function build(startsOn: string | null, endsOn: string | null) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('fixture-1') };
  const lookup = {
    require: vi.fn().mockResolvedValue(competition(startsOn, endsOn)),
  };
  const scope = { requireVenue: vi.fn().mockResolvedValue(undefined) };
  const linkage = { validate: vi.fn().mockResolvedValue(undefined) };
  const repository = { insert: vi.fn().mockResolvedValue(fixture()) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateFixtureUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    lookup as never,
    scope as never,
    linkage as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { lookup, scope, linkage, repository, audit, events, useCase };
}

describe('CreateFixtureUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build('2026-01-01', '2026-03-01');
  });

  it('books a fixture inside the window and presents it in Cairo', async () => {
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'comp-1',
      command(),
    );
    expect(harness.linkage.validate).toHaveBeenCalledOnce();
    expect(harness.scope.requireVenue).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(view.scheduledAtCairo).toBe('2026-01-15T20:30');
    expect(view.timezone).toBe('Africa/Cairo');
  });

  it('rejects a fixture whose Cairo day is outside the window', async () => {
    const narrow = build('2026-02-01', '2026-03-01');
    await expect(
      narrow.useCase.execute(ACTOR, 'team-1', 'comp-1', command()),
    ).rejects.toBeInstanceOf(FixtureScheduleError);
    expect(narrow.repository.insert).not.toHaveBeenCalled();
  });

  it('accepts an open window (null bounds)', async () => {
    const open = build(null, null);
    await expect(
      open.useCase.execute(ACTOR, 'team-1', 'comp-1', command()),
    ).resolves.toMatchObject({ fixtureId: 'fixture-1' });
  });
});
