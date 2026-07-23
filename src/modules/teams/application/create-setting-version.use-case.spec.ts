import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUDIT_NONSENSE_PAYLOAD,
  VALID_ATTENDANCE_STATUSES,
  VALID_ATTENDANCE_WEIGHTS,
  VALID_BADGE_TIERS,
  VALID_ROSTER_LIMITS,
} from '../../../../test/fixtures/setting-values.fixture';
import { SettingEffectiveInvalidError } from '../errors/setting-effective-invalid.error';
import { SettingEffectiveInPastError } from '../errors/setting-effective-past.error';
import { SettingValueInvalidError } from '../errors/setting-value-invalid.error';
import { SettingVersionConflictError } from '../errors/setting-version-conflict.error';
import { SettingVersionStaleError } from '../errors/setting-version-stale.error';
import { SettingValueState } from '../model/setting-values.enums';
import { SettingKey } from '../model/teams.enums';
import type {
  CreateSettingVersionCommand,
  SettingVersion,
} from '../model/teams.types';
import { CreateSettingVersionUseCase } from './create-setting-version.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const FUTURE = '2026-06-01T13:00:00.000Z';
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const VERSION: SettingVersion = {
  id: 'sv-1',
  teamId: 'team-1',
  settingKey: SettingKey.BadgeTiers,
  effectiveFrom: new Date(FUTURE),
  value: VALID_BADGE_TIERS,
  note: 'seasonal tier refresh',
  createdBy: 'admin-1',
  createdAt: NOW,
};

const COMMAND: CreateSettingVersionCommand = {
  settingKey: SettingKey.BadgeTiers,
  effectiveFrom: FUTURE,
  value: VALID_BADGE_TIERS,
  note: 'seasonal tier refresh',
};

const STATUSES_VERSION: SettingVersion = {
  ...VERSION,
  id: 'sv-statuses',
  settingKey: SettingKey.AttendanceStatuses,
  value: VALID_ATTENDANCE_STATUSES,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const settings = {
    existsAtInstant: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(VERSION),
    findEffectiveForKey: vi.fn().mockResolvedValue(null),
    findHead: vi.fn().mockResolvedValue(null),
  };
  const catalog = { listActiveKeys: vi.fn().mockResolvedValue([]) };
  const audit = { append: vi.fn() };
  const useCase = new CreateSettingVersionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    settings as never,
    catalog as never,
    audit,
  );
  return { useCase, settings, catalog, audit };
}

describe('CreateSettingVersionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends a setting version, audits and reports it valid', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(result.valueState).toBe(SettingValueState.Valid);
    expect(harness.settings.insert.mock.calls[0]?.[1]).toMatchObject({
      settingKey: SettingKey.BadgeTiers,
      effectiveFrom: new Date(FUTURE),
      note: 'seasonal tier refresh',
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('persists the normalized policy output, not the raw body object', async () => {
    await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    const persisted = harness.settings.insert.mock.calls[0]?.[1]?.value;
    expect(persisted).toEqual(VALID_BADGE_TIERS);
    expect(persisted).not.toBe(COMMAND.value);
  });

  it('rejects a duplicate effective instant', async () => {
    harness.settings.existsAtInstant.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SettingVersionConflictError);
    expect(harness.settings.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid value without inserting or auditing', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        value: { tiers: [100, 200] },
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
    expect(harness.settings.insert).not.toHaveBeenCalled();
    expect(harness.audit.append).not.toHaveBeenCalled();
  });

  it('rejects the audit nonsense payload (regression pin)', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        settingKey: SettingKey.AttendanceStatuses,
        value: AUDIT_NONSENSE_PAYLOAD,
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
  });

  it('rejects a past effective instant beyond the grace window', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        effectiveFrom: '2026-06-01T11:54:00.000Z',
      }),
    ).rejects.toBeInstanceOf(SettingEffectiveInPastError);
  });

  it('accepts an instant inside the clock-skew grace window', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', {
      ...COMMAND,
      effectiveFrom: '2026-06-01T11:56:00.000Z',
    });
    expect(result.valueState).toBe(SettingValueState.Valid);
  });

  it.each([
    ['offset-less local string', '2026-07-22T12:00'],
    ['offset instead of Z', '2026-07-22T12:00:00+02:00'],
    ['date only', '2026-07-22'],
    ['impossible calendar date', '2026-02-31T00:00:00Z'],
  ])('rejects a non-strict-UTC effectiveFrom (%s)', async (_label, raw) => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        effectiveFrom: raw,
      }),
    ).rejects.toBeInstanceOf(SettingEffectiveInvalidError);
    expect(harness.settings.insert).not.toHaveBeenCalled();
  });

  it('rejects a stale expectedHeadVersionId (D8)', async () => {
    harness.settings.findHead.mockResolvedValue(VERSION);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        expectedHeadVersionId: 'some-older-version',
      }),
    ).rejects.toBeInstanceOf(SettingVersionStaleError);
  });

  it('rejects a null expectedHeadVersionId when versions already exist', async () => {
    harness.settings.findHead.mockResolvedValue(VERSION);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        expectedHeadVersionId: null,
      }),
    ).rejects.toBeInstanceOf(SettingVersionStaleError);
  });

  it('accepts a matching head guard and skips the check when absent', async () => {
    harness.settings.findHead.mockResolvedValue(VERSION);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        expectedHeadVersionId: VERSION.id,
      }),
    ).resolves.toMatchObject({ valueState: SettingValueState.Valid });

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).resolves.toBeDefined();
  });

  it('validates weights against the statuses effective at the weights instant', async () => {
    harness.settings.findEffectiveForKey.mockResolvedValue(STATUSES_VERSION);
    const result = await harness.useCase.execute(ACTOR, 'team-1', {
      ...COMMAND,
      settingKey: SettingKey.AttendanceWeights,
      value: VALID_ATTENDANCE_WEIGHTS,
    });
    expect(result.valueState).toBe(SettingValueState.Valid);
    expect(harness.settings.findEffectiveForKey).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      SettingKey.AttendanceStatuses,
      new Date(FUTURE),
    );
  });

  it('rejects weights when statuses are not configured at that instant', async () => {
    harness.settings.findEffectiveForKey.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        settingKey: SettingKey.AttendanceWeights,
        value: VALID_ATTENDANCE_WEIGHTS,
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
  });

  it('treats legacy statuses as not configured for the weights check', async () => {
    harness.settings.findEffectiveForKey.mockResolvedValue({
      ...STATUSES_VERSION,
      value: {},
    });
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        settingKey: SettingKey.AttendanceWeights,
        value: VALID_ATTENDANCE_WEIGHTS,
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
  });

  it('rejects weights keyed by a code unknown to the effective statuses', async () => {
    harness.settings.findEffectiveForKey.mockResolvedValue(STATUSES_VERSION);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        settingKey: SettingKey.AttendanceWeights,
        value: { weights: { present_on_time: 1, absent: 0, injured: 0.5 } },
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
  });

  it('validates roster position keys against the active catalog', async () => {
    harness.catalog.listActiveKeys.mockResolvedValue(['handler', 'cutter']);
    const result = await harness.useCase.execute(ACTOR, 'team-1', {
      ...COMMAND,
      settingKey: SettingKey.RosterLimits,
      value: VALID_ROSTER_LIMITS,
    });
    expect(result.valueState).toBe(SettingValueState.Valid);
  });

  it('rejects a roster referencing an unknown position key', async () => {
    harness.catalog.listActiveKeys.mockResolvedValue(['handler']);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        settingKey: SettingKey.RosterLimits,
        value: VALID_ROSTER_LIMITS,
      }),
    ).rejects.toBeInstanceOf(SettingValueInvalidError);
  });

  it('skips the catalog load when the roster has no per-position limits', async () => {
    await harness.useCase.execute(ACTOR, 'team-1', {
      ...COMMAND,
      settingKey: SettingKey.RosterLimits,
      value: { roster: { max: 27 } },
    });
    expect(harness.catalog.listActiveKeys).not.toHaveBeenCalled();
  });
});
