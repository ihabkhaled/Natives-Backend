import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingKey } from '../model/teams.enums';
import type { SettingVersionRow } from '../model/teams.rows';
import type { NewSettingVersion } from '../model/teams.types';
import { SettingVersionRepository } from './setting-version.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const EFFECTIVE = new Date('2026-01-01T00:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function versionRow(
  overrides: Partial<SettingVersionRow> = {},
): SettingVersionRow {
  return {
    id: 'sv-1',
    team_id: 'team-1',
    setting_key: 'attendance_weights',
    effective_from: '2026-01-01T00:00:00.000Z',
    value: { practice: 3 },
    note: null,
    created_by: 'admin-1',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NEW_VERSION: NewSettingVersion = {
  id: 'sv-1',
  teamId: 'team-1',
  settingKey: SettingKey.AttendanceWeights,
  effectiveFrom: EFFECTIVE,
  value: { practice: 3 },
  note: null,
  createdBy: 'admin-1',
  now: NOW,
};

describe('SettingVersionRepository', () => {
  let repository: SettingVersionRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new SettingVersionRepository();
    scope = buildScope();
  });

  it('reports whether a version exists at an instant', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'sv-1' }]);
    await expect(
      repository.existsAtInstant(
        scope as never,
        'team-1',
        'attendance_weights',
        EFFECTIVE,
      ),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsAtInstant(
        scope as never,
        'team-1',
        'attendance_weights',
        EFFECTIVE,
      ),
    ).resolves.toBe(false);
  });

  it('inserts a version, serializes value as jsonb, and maps the row', async () => {
    scope.run.mockResolvedValue([versionRow()]);
    const result = await repository.insert(scope as never, NEW_VERSION);
    expect(result.settingKey).toBe(SettingKey.AttendanceWeights);
    expect(result.effectiveFrom).toEqual(EFFECTIVE);
    expect(scope.run.mock.calls[0]?.[1]?.[4]).toBe(
      JSON.stringify({ practice: 3 }),
    );
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(
      repository.insert(scope as never, NEW_VERSION),
    ).rejects.toThrow(/returned row/u);
  });

  it('loads the effective version per key', async () => {
    scope.run.mockResolvedValueOnce([versionRow()]);
    const effective = await repository.loadEffective(
      scope as never,
      'team-1',
      NOW,
    );
    expect(effective).toHaveLength(1);
    expect(effective[0]?.value).toEqual({ practice: 3 });
  });

  it('finds the effective version for one key at an instant', async () => {
    scope.run.mockResolvedValueOnce([versionRow()]);
    const found = await repository.findEffectiveForKey(
      scope as never,
      'team-1',
      'attendance_statuses',
      NOW,
    );
    expect(found?.id).toBe('sv-1');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'attendance_statuses',
      NOW.toISOString(),
    ]);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findEffectiveForKey(
        scope as never,
        'team-1',
        'attendance_statuses',
        NOW,
      ),
    ).resolves.toBeNull();
  });

  it('finds the head (newest) version for a key', async () => {
    scope.run.mockResolvedValueOnce([versionRow()]);
    const head = await repository.findHead(
      scope as never,
      'team-1',
      'attendance_weights',
    );
    expect(head?.id).toBe('sv-1');

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findHead(scope as never, 'team-1', 'attendance_weights'),
    ).resolves.toBeNull();
  });

  it('finds a version by id within the team scope', async () => {
    scope.run.mockResolvedValueOnce([versionRow()]);
    const found = await repository.findById(scope as never, 'team-1', 'sv-1');
    expect(found?.settingKey).toBe(SettingKey.AttendanceWeights);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findById(scope as never, 'team-1', 'missing'),
    ).resolves.toBeNull();
  });

  it('deletes a version by id and reports whether a row was removed', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'sv-1' }]);
    await expect(
      repository.deleteById(scope as never, 'team-1', 'sv-1'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.deleteById(scope as never, 'team-1', 'missing'),
    ).resolves.toBe(false);
  });

  it('lists versions for a key with a total, defaulting to zero', async () => {
    scope.run.mockResolvedValueOnce([versionRow()]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      repository.listForKey(scope as never, 'team-1', 'attendance_weights', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({ total: 1 });

    scope.run.mockResolvedValueOnce([]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repository.listForKey(
      scope as never,
      'team-1',
      'attendance_weights',
      { limit: 20, offset: 0 },
    );
    expect(fallback.total).toBe(0);
  });
});
