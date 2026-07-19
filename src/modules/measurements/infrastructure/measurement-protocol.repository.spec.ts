import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ResultPolicy,
} from '../model/measurements.enums';
import type { MeasurementProtocolRow } from '../model/measurements.rows';
import type { NewProtocol, ProtocolContent } from '../model/measurements.types';
import { MeasurementProtocolRepository } from './measurement-protocol.repository';

const NOW = new Date('2026-06-01T09:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new MeasurementProtocolRepository() };
}

function protocolRow(
  overrides: Partial<MeasurementProtocolRow> = {},
): MeasurementProtocolRow {
  return {
    id: 'protocol-1',
    team_id: 'team-1',
    season_id: null,
    protocol_key: 'sprint_20m',
    name: '20 m sprint',
    description: null,
    discipline: 'speed',
    unit: 'seconds',
    direction: 'better_lower',
    result_policy: 'best',
    instructions: null,
    safety_notes: null,
    min_value: null,
    max_value: null,
    status: 'active',
    record_version: 1,
    created_by: 'coach-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function content(): ProtocolContent {
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
  };
}

function newProtocol(): NewProtocol {
  return {
    id: 'protocol-1',
    teamId: 'team-1',
    content: content(),
    createdBy: 'coach-1',
    now: NOW,
  };
}

describe('MeasurementProtocolRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a protocol and throws when no row returns', async () => {
    harness.scope.run.mockResolvedValueOnce([protocolRow()]);
    await expect(
      harness.repository.insert(harness.scope as never, newProtocol()),
    ).resolves.toMatchObject({ id: 'protocol-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insert(harness.scope as never, newProtocol()),
    ).rejects.toThrow('Expected a returned row');
  });

  it('reports an active key conflict', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      harness.repository.activeKeyExists(
        harness.scope as never,
        'team-1',
        'sprint_20m',
      ),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.activeKeyExists(
        harness.scope as never,
        'team-1',
        'sprint_20m',
      ),
    ).resolves.toBe(false);
  });

  it('finds a visible protocol or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([protocolRow()]);
    await expect(
      harness.repository.findVisible(
        harness.scope as never,
        'team-1',
        'protocol-1',
      ),
    ).resolves.toMatchObject({ id: 'protocol-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findVisible(
        harness.scope as never,
        'team-1',
        'protocol-1',
      ),
    ).resolves.toBeNull();
  });

  it('lists and counts protocols for a team', async () => {
    harness.scope.run.mockResolvedValueOnce([
      protocolRow(),
      protocolRow({ id: 'protocol-2' }),
    ]);
    await expect(
      harness.repository.listForTeam(harness.scope as never, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toHaveLength(2);
    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });

  it('lists by ids, short-circuiting an empty id list', async () => {
    await expect(
      harness.repository.listByIds(harness.scope as never, 'team-1', []),
    ).resolves.toEqual([]);
    expect(harness.scope.run).not.toHaveBeenCalled();
    harness.scope.run.mockResolvedValueOnce([protocolRow()]);
    await expect(
      harness.repository.listByIds(harness.scope as never, 'team-1', [
        'protocol-1',
      ]),
    ).resolves.toHaveLength(1);
  });
});
