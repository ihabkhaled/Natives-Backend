import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamInvalidTransitionError } from '../errors/team-invalid-transition.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { TransitionTeamUseCase } from './transition-team.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    slug: 'un',
    name: 'Ultimate Natives',
    locale: 'en',
    timezone: 'Africa/Cairo',
    primaryColor: null,
    logoMediaKey: null,
    status: TeamStatus.Active,
    deletedAt: null,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teams = { findById: vi.fn(), applyStatusChange: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new TransitionTeamUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teams as never,
    audit,
  );
  return { audit, teams, useCase };
}

describe('TransitionTeamUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('disables an active team, stamping the actor and auditing the move', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.applyStatusChange.mockResolvedValue(
      team({ status: TeamStatus.Disabled, version: 2 }),
    );

    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      TeamStatus.Disabled,
      { expectedVersion: 1 },
    );

    expect(result.status).toBe(TeamStatus.Disabled);
    expect(harness.teams.applyStatusChange).toHaveBeenCalledWith(SCOPE, {
      id: 'team-1',
      status: TeamStatus.Disabled,
      updatedBy: 'admin-1',
      expectedVersion: 1,
      now: NOW,
    });
    expect(harness.audit.append).toHaveBeenCalledWith(SCOPE, {
      id: 'generated',
      eventType: 'team.transitioned',
      actorUserId: 'admin-1',
      context: {
        teamId: 'team-1',
        from: TeamStatus.Active,
        to: TeamStatus.Disabled,
      },
      occurredAt: NOW,
    });
  });

  it('reports not-found for a missing or already-removed team', async () => {
    harness.teams.findById.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', TeamStatus.Disabled, {
        expectedVersion: null,
      }),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('rejects a move the state machine forbids', async () => {
    harness.teams.findById.mockResolvedValue(
      team({ status: TeamStatus.Archived }),
    );

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', TeamStatus.Disabled, {
        expectedVersion: null,
      }),
    ).rejects.toBeInstanceOf(TeamInvalidTransitionError);
    expect(harness.teams.applyStatusChange).not.toHaveBeenCalled();
  });

  it('reports a version conflict when the guarded write misses', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.applyStatusChange.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', TeamStatus.Archived, {
        expectedVersion: 9,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
