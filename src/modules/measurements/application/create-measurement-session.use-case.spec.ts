import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStatus } from '../model/measurements.enums';
import type {
  MeasurementSession,
  SessionContent,
} from '../model/measurements.types';
import { CreateMeasurementSessionUseCase } from './create-measurement-session.use-case';

const NOW = new Date('2026-06-01T09:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function content(): SessionContent {
  return {
    title: 'Combine',
    seasonId: null,
    scheduledAt: '2026-06-01T09:00:00.000Z',
    location: null,
    conditions: null,
    notes: null,
  };
}

function session(): MeasurementSession {
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
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'session-1') };
  const scope = { validate: vi.fn() };
  const repository = { insert: vi.fn(() => session()) };
  const audit = { record: vi.fn() };
  return {
    scope,
    repository,
    audit,
    useCase: new CreateMeasurementSessionUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      repository as never,
      audit as never,
    ),
  };
}

describe('CreateMeasurementSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope, persists a scheduled session, and audits', async () => {
    const created = await harness.useCase.execute(actor, 'team-1', {
      content: content(),
    });
    expect(harness.scope.validate).toHaveBeenCalled();
    expect(harness.repository.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
    expect(created.status).toBe(SessionStatus.Scheduled);
  });
});
