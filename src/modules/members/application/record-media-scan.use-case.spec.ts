import { describe, expect, it, vi } from 'vitest';

import { MediaNotFoundError } from '../errors/media-not-found.error';
import { MediaPurpose, MediaScanStatus } from '../model/members.enums';
import type { MediaAsset } from '../model/members.types';
import { RecordMediaScanUseCase } from './record-media-scan.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

function asset(scanStatus: MediaScanStatus): MediaAsset {
  return {
    id: 'md-1',
    teamId: 'team-1',
    membershipId: 'mem-1',
    purpose: MediaPurpose.Avatar,
    storageKey: 'members/team-1/mem-1/md-1',
    contentType: 'image/png',
    byteSize: 2048,
    width: 256,
    height: 256,
    scanStatus,
    createdBy: 'admin-1',
    createdAt: NOW,
    deletedAt: null,
  };
}

function build(existing: MediaAsset | null, updated: MediaAsset | null) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue({}) };
  const media = {
    findById: vi.fn().mockResolvedValue(existing),
    updateScanStatus: vi.fn().mockResolvedValue(updated),
  };
  const audit = { append: vi.fn() };
  const useCase = new RecordMediaScanUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    media as never,
    audit,
  );
  return { useCase, media, audit };
}

describe('RecordMediaScanUseCase', () => {
  it('throws when the media asset does not exist', async () => {
    const { useCase } = build(null, null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1', {
        outcome: MediaScanStatus.Clean,
      }),
    ).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it('throws when the update finds no row', async () => {
    const { useCase } = build(asset(MediaScanStatus.Pending), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1', {
        outcome: MediaScanStatus.Clean,
      }),
    ).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it('records the scan outcome and returns a projection without the storage key', async () => {
    const { useCase, audit } = build(
      asset(MediaScanStatus.Pending),
      asset(MediaScanStatus.Clean),
    );
    const response = await useCase.execute(ACTOR, 'team-1', 'mem-1', 'md-1', {
      outcome: MediaScanStatus.Clean,
    });
    expect(response.scanStatus).toBe(MediaScanStatus.Clean);
    expect('storageKey' in response).toBe(false);
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
