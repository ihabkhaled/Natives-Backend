import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementInvalidTransitionError } from '../errors/measurement-invalid-transition.error';
import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import { MeasurementVersionConflictError } from '../errors/measurement-version-conflict.error';
import { SessionStatus, SessionTransition } from '../model/measurements.enums';
import type { MeasurementSession } from '../model/measurements.types';
import { TransitionMeasurementSessionUseCase } from './transition-measurement-session.use-case';

const NOW = new Date('2026-06-01T09:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function session(
  overrides: Partial<MeasurementSession> = {},
): MeasurementSession {
  return {
    id: 'session-1',
    teamId: 'team-1',
    seasonId: null,
    title: 'Combine',
    status: SessionStatus.Scheduled,
    scheduledAt: NOW,
    conductedAt: null,
    location: null,
    conditions: null,
    notes: null,
    recordVersion: 1,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const scope = { validate: vi.fn() };
  const repository = { findForWrite: vi.fn(), applyStatusChange: vi.fn() };
  const audit = { record: vi.fn() };
  return {
    repository,
    audit,
    useCase: new TransitionMeasurementSessionUseCase(
      unitOfWork as never,
      clock as never,
      scope as never,
      repository as never,
      audit as never,
    ),
  };
}

function command(transition = SessionTransition.Conduct) {
  return { transition, expectedRecordVersion: 1 };
}

describe('TransitionMeasurementSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('conducts a scheduled session and audits', async () => {
    harness.repository.findForWrite.mockResolvedValue(session());
    harness.repository.applyStatusChange.mockResolvedValue(
      session({ status: SessionStatus.Conducted, conductedAt: NOW }),
    );
    const updated = await harness.useCase.execute(
      actor,
      'team-1',
      'session-1',
      command(),
    );
    expect(updated.status).toBe(SessionStatus.Conducted);
    expect(harness.audit.record).toHaveBeenCalled();
  });

  it('404s when the session does not exist', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementSessionNotFoundError);
  });

  it('rejects an illegal transition from a terminal state', async () => {
    harness.repository.findForWrite.mockResolvedValue(
      session({ status: SessionStatus.Cancelled }),
    );
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementInvalidTransitionError);
    expect(harness.repository.applyStatusChange).not.toHaveBeenCalled();
  });

  it('reports a stale record version as a conflict', async () => {
    harness.repository.findForWrite.mockResolvedValue(session());
    harness.repository.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'session-1', command()),
    ).rejects.toBeInstanceOf(MeasurementVersionConflictError);
  });
});
