import { describe, expect, it, vi } from 'vitest';

import { DrillNameConflictError } from '../errors/drill-name-conflict.error';
import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import {
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../model/agendas.enums';
import type { Drill } from '../model/agendas.types';
import { DrillCatalogService } from './drill-catalog.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

function drill(status: DrillStatus = DrillStatus.Active): Drill {
  return {
    id: 'drill-1',
    teamId: 'team-1',
    seasonId: null,
    name: 'Give and go',
    category: DrillCategory.Offense,
    objective: null,
    instructions: null,
    equipment: [],
    intensity: DrillIntensity.Moderate,
    defaultDurationMinutes: null,
    skillTags: [],
    safetyNotes: null,
    mediaUrl: null,
    status,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function command() {
  return {
    seasonId: null,
    name: 'Give and go',
    category: DrillCategory.Offense,
    objective: null,
    instructions: null,
    equipment: [],
    intensity: DrillIntensity.Moderate,
    defaultDurationMinutes: null,
    skillTags: [],
    safetyNotes: null,
    mediaUrl: null,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('drill-1') };
  const scopeValidation = { validate: vi.fn().mockResolvedValue(undefined) };
  const drills = {
    insert: vi.fn().mockResolvedValue(drill()),
    findByIdInTeam: vi.fn().mockResolvedValue(drill()),
    activeNameExists: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(drill()),
    archive: vi.fn().mockResolvedValue(drill(DrillStatus.Archived)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new DrillCatalogService(
    unitOfWork as never,
    clock,
    idGenerator,
    scopeValidation as never,
    drills as never,
    audit as never,
  );
  return { service, drills, scopeValidation, audit };
}

describe('DrillCatalogService', () => {
  it('creates a drill and audits it', async () => {
    const h = build();
    const view = await h.service.createDrill(ACTOR, 'team-1', command());
    expect(view.id).toBe('drill-1');
    expect(h.scopeValidation.validate).toHaveBeenCalled();
    expect(h.audit.record).toHaveBeenCalledOnce();
  });

  it('maps a duplicate name to a clean conflict', async () => {
    const h = build();
    h.drills.insert.mockResolvedValue(null);
    await expect(
      h.service.createDrill(ACTOR, 'team-1', command()),
    ).rejects.toBeInstanceOf(DrillNameConflictError);
  });

  it('updates a drill under name and version guards', async () => {
    const h = build();
    const view = await h.service.updateDrill(ACTOR, 'team-1', 'drill-1', {
      ...command(),
      expectedVersion: 1,
    });
    expect(view.id).toBe('drill-1');
  });

  it('rejects updating a missing drill', async () => {
    const h = build();
    h.drills.findByIdInTeam.mockResolvedValue(null);
    await expect(
      h.service.updateDrill(ACTOR, 'team-1', 'x', {
        ...command(),
        expectedVersion: null,
      }),
    ).rejects.toBeInstanceOf(DrillNotFoundError);
  });

  it('rejects a rename onto an existing active name', async () => {
    const h = build();
    h.drills.activeNameExists.mockResolvedValue(true);
    await expect(
      h.service.updateDrill(ACTOR, 'team-1', 'drill-1', {
        ...command(),
        expectedVersion: null,
      }),
    ).rejects.toBeInstanceOf(DrillNameConflictError);
  });

  it('maps a lost update race to a version conflict', async () => {
    const h = build();
    h.drills.update.mockResolvedValue(null);
    await expect(
      h.service.updateDrill(ACTOR, 'team-1', 'drill-1', {
        ...command(),
        expectedVersion: 9,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('archives a drill and is idempotent when already archived', async () => {
    const h = build();
    const view = await h.service.archiveDrill(ACTOR, 'team-1', 'drill-1');
    expect(view.status).toBe(DrillStatus.Archived);

    h.drills.archive.mockResolvedValue(null);
    const again = await h.service.archiveDrill(ACTOR, 'team-1', 'drill-1');
    expect(again.status).toBe(DrillStatus.Active);
  });

  it('rejects archiving a missing drill', async () => {
    const h = build();
    h.drills.findByIdInTeam.mockResolvedValue(null);
    await expect(
      h.service.archiveDrill(ACTOR, 'team-1', 'x'),
    ).rejects.toBeInstanceOf(DrillNotFoundError);
  });
});
