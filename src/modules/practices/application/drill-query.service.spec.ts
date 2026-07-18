import { describe, expect, it, vi } from 'vitest';

import { DrillNotFoundError } from '../errors/drill-not-found.error';
import {
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../model/agendas.enums';
import type { Drill } from '../model/agendas.types';
import { DrillQueryService } from './drill-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

function drill(): Drill {
  return {
    id: 'drill-1',
    teamId: 'team-1',
    seasonId: null,
    name: 'Break mark',
    category: DrillCategory.Offense,
    objective: null,
    instructions: null,
    equipment: [],
    intensity: DrillIntensity.Moderate,
    defaultDurationMinutes: null,
    skillTags: [],
    safetyNotes: null,
    mediaUrl: null,
    status: DrillStatus.Active,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const drills = {
    list: vi.fn().mockResolvedValue([drill()]),
    count: vi.fn().mockResolvedValue(1),
    findByIdInTeam: vi.fn().mockResolvedValue(drill()),
  };
  const service = new DrillQueryService(unitOfWork as never, drills as never);
  return { service, drills };
}

describe('DrillQueryService', () => {
  it('lists drills with a clamped, filtered query', async () => {
    const h = build();
    const view = await h.service.list('team-1', {
      limit: 5000,
      category: DrillCategory.Offense,
    });
    expect(view.total).toBe(1);
    expect(view.items[0]?.id).toBe('drill-1');
    expect(h.drills.list.mock.calls[0]?.[2]).toMatchObject({ limit: 100 });
  });

  it('gets one drill or 404s', async () => {
    const h = build();
    expect((await h.service.getDrill('team-1', 'drill-1')).id).toBe('drill-1');
    h.drills.findByIdInTeam.mockResolvedValue(null);
    await expect(h.service.getDrill('team-1', 'x')).rejects.toBeInstanceOf(
      DrillNotFoundError,
    );
  });
});
