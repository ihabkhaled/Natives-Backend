import { describe, expect, it, vi } from 'vitest';

import { MediaValidationError } from '../errors/media-validation.error';
import { ProfileForbiddenError } from '../errors/profile-forbidden.error';
import { MediaPurpose, MediaScanStatus } from '../model/members.enums';
import type { MediaAsset, RequestAvatarCommand } from '../model/members.types';
import { RequestAvatarUploadUseCase } from './request-avatar-upload.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const EXPIRES = new Date('2026-06-01T12:05:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

const VALID: RequestAvatarCommand = {
  contentType: 'image/png',
  byteSize: 2048,
  width: 256,
  height: 256,
};

function asset(): MediaAsset {
  return {
    id: 'gen',
    teamId: 'team-1',
    membershipId: 'mem-1',
    purpose: MediaPurpose.Avatar,
    storageKey: 'members/team-1/mem-1/gen',
    contentType: 'image/png',
    byteSize: 2048,
    width: 256,
    height: 256,
    scanStatus: MediaScanStatus.Pending,
    createdBy: 'user-1',
    createdAt: NOW,
    deletedAt: null,
  };
}

function build(canManage: boolean, isSelf: boolean) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const storage = {
    createUploadUrl: vi
      .fn()
      .mockReturnValue({ url: 'https://media/put', expiresAt: EXPIRES }),
    createDownloadUrl: vi.fn(),
  };
  const lookup = {
    requireMembership: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', teamId: 'team-1' }),
  };
  const access = {
    resolveAccess: vi.fn().mockResolvedValue({
      viewer: { tier: 'public', isSelf },
      canManage,
    }),
  };
  const media = { insert: vi.fn().mockResolvedValue(asset()) };
  const audit = { append: vi.fn() };
  const useCase = new RequestAvatarUploadUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    storage,
    lookup as never,
    access as never,
    media as never,
    audit,
  );
  return { useCase, storage, media, audit };
}

describe('RequestAvatarUploadUseCase', () => {
  it('forbids a non-owner without management rights', async () => {
    const { useCase } = build(false, false);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', VALID),
    ).rejects.toBeInstanceOf(ProfileForbiddenError);
  });

  it('rejects media that fails validation', async () => {
    const { useCase } = build(false, true);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', {
        ...VALID,
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it('registers a pending asset and returns a signed upload ticket', async () => {
    const { useCase, media, audit } = build(true, false);
    const ticket = await useCase.execute(ACTOR, 'team-1', 'mem-1', VALID);
    expect(ticket.uploadUrl).toBe('https://media/put');
    expect(ticket.expiresAt).toBe(EXPIRES);
    expect(media.insert).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
