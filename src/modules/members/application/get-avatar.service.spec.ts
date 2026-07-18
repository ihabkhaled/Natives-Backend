import { describe, expect, it, vi } from 'vitest';

import { MediaScanStatus } from '../model/members.enums';
import type { MediaAsset, MemberProfile } from '../model/members.types';
import { GetAvatarService } from './get-avatar.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const EXPIRES = new Date('2026-06-01T00:05:00.000Z');

function record(avatarMediaId: string | null) {
  return { membership: {}, profile: { avatarMediaId } as MemberProfile };
}

function cleanAsset(): MediaAsset {
  return {
    id: 'md-1',
    teamId: 'team-1',
    membershipId: 'mem-1',
    purpose: 'avatar' as MediaAsset['purpose'],
    storageKey: 'members/team-1/mem-1/md-1',
    contentType: 'image/png',
    byteSize: 2048,
    width: 256,
    height: 256,
    scanStatus: MediaScanStatus.Clean,
    createdBy: 'admin-1',
    createdAt: NOW,
    deletedAt: null,
  };
}

function build(avatarMediaId: string | null) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const storage = {
    createDownloadUrl: vi
      .fn()
      .mockReturnValue({ url: 'https://media/x', expiresAt: EXPIRES }),
    createUploadUrl: vi.fn(),
  };
  const lookup = {
    requireRecord: vi.fn().mockResolvedValue(record(avatarMediaId)),
  };
  const media = { findById: vi.fn() };
  const service = new GetAvatarService(
    unitOfWork as never,
    clock,
    storage,
    lookup as never,
    media as never,
  );
  return { service, storage, media };
}

describe('GetAvatarService', () => {
  it('returns a null url when no avatar is set', async () => {
    const { service } = build(null);
    await expect(service.getAvatarUrl('team-1', 'mem-1')).resolves.toEqual({
      url: null,
      expiresAt: null,
    });
  });

  it('returns a null url when the asset is missing', async () => {
    const { service, media } = build('md-1');
    media.findById.mockResolvedValue(null);
    await expect(service.getAvatarUrl('team-1', 'mem-1')).resolves.toEqual({
      url: null,
      expiresAt: null,
    });
  });

  it('returns a null url when the asset is not scanned clean', async () => {
    const { service, media } = build('md-1');
    media.findById.mockResolvedValue({
      ...cleanAsset(),
      scanStatus: MediaScanStatus.Pending,
    });
    await expect(service.getAvatarUrl('team-1', 'mem-1')).resolves.toEqual({
      url: null,
      expiresAt: null,
    });
  });

  it('returns a signed url for a clean avatar', async () => {
    const { service, media, storage } = build('md-1');
    media.findById.mockResolvedValue(cleanAsset());
    const result = await service.getAvatarUrl('team-1', 'mem-1');
    expect(result).toEqual({ url: 'https://media/x', expiresAt: EXPIRES });
    expect(storage.createDownloadUrl).toHaveBeenCalledWith({
      storageKey: 'members/team-1/mem-1/md-1',
      now: NOW,
    });
  });
});
