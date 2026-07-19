import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementProtocolDuplicateError } from '../errors/measurement-protocol-duplicate.error';
import { MeasurementValidationError } from '../errors/measurement-validation.error';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
} from '../model/measurements.enums';
import type {
  MeasurementProtocol,
  ProtocolContent,
} from '../model/measurements.types';
import { CreateMeasurementProtocolUseCase } from './create-measurement-protocol.use-case';

const NOW = new Date('2026-06-01T09:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function content(overrides: Partial<ProtocolContent> = {}): ProtocolContent {
  return {
    protocolKey: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    seasonId: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: null,
    maxValue: null,
    ...overrides,
  };
}

function protocol(): MeasurementProtocol {
  return {
    id: 'protocol-1',
    teamId: 'team-1',
    seasonId: null,
    protocolKey: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    discipline: MeasurementDiscipline.Speed,
    unit: MeasurementUnit.Seconds,
    direction: MeasurementDirection.BetterLower,
    resultPolicy: ResultPolicy.Best,
    instructions: null,
    safetyNotes: null,
    minValue: null,
    maxValue: null,
    status: ProtocolStatus.Active,
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
  const idGenerator = { generate: vi.fn(() => 'protocol-1') };
  const scope = { validate: vi.fn() };
  const repository = {
    activeKeyExists: vi.fn(() => false),
    insert: vi.fn(() => protocol()),
  };
  const audit = { record: vi.fn() };
  return {
    scope,
    repository,
    audit,
    useCase: new CreateMeasurementProtocolUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      repository as never,
      audit as never,
    ),
  };
}

describe('CreateMeasurementProtocolUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope + content, checks uniqueness, persists, and audits', async () => {
    const created = await harness.useCase.execute(actor, 'team-1', {
      content: content(),
    });
    expect(harness.scope.validate).toHaveBeenCalled();
    expect(harness.repository.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
    expect(created.id).toBe('protocol-1');
  });

  it('rejects a duplicate active key before persisting', async () => {
    harness.repository.activeKeyExists.mockResolvedValueOnce(true);
    await expect(
      harness.useCase.execute(actor, 'team-1', { content: content() }),
    ).rejects.toBeInstanceOf(MeasurementProtocolDuplicateError);
    expect(harness.repository.insert).not.toHaveBeenCalled();
  });

  it('rejects invalid content before touching persistence', async () => {
    await expect(
      harness.useCase.execute(actor, 'team-1', {
        content: content({ protocolKey: 'a' }),
      }),
    ).rejects.toBeInstanceOf(MeasurementValidationError);
    expect(harness.repository.activeKeyExists).not.toHaveBeenCalled();
    expect(harness.repository.insert).not.toHaveBeenCalled();
  });
});
