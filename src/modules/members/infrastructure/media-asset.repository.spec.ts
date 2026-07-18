import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaPurpose, MediaScanStatus } from '../model/members.enums';
import type { MediaAssetRow } from '../model/members.rows';
import type { NewMediaAsset } from '../model/members.types';
import { MediaAssetRepository } from './media-asset.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function mediaRow(overrides: Partial<MediaAssetRow> = {}): MediaAssetRow {
  return {
    id: 'md-1',
    team_id: 'team-1',
    membership_id: 'mem-1',
    purpose: 'avatar',
    storage_key: 'members/team-1/mem-1/md-1',
    content_type: 'image/png',
    byte_size: '2048',
    width: 256,
    height: 256,
    scan_status: 'pending',
    created_by: 'admin-1',
    created_at: NOW.toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

const NEW_ASSET: NewMediaAsset = {
  id: 'md-1',
  teamId: 'team-1',
  membershipId: 'mem-1',
  purpose: MediaPurpose.Avatar,
  storageKey: 'members/team-1/mem-1/md-1',
  contentType: 'image/png',
  byteSize: 2048,
  width: 256,
  height: 256,
  createdBy: 'admin-1',
  now: NOW,
};

describe('MediaAssetRepository', () => {
  let repo: MediaAssetRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new MediaAssetRepository();
    scope = buildScope();
  });

  it('inserts a media asset and maps the row', async () => {
    scope.run.mockResolvedValueOnce([mediaRow()]);
    await expect(repo.insert(scope as never, NEW_ASSET)).resolves.toMatchObject(
      {
        purpose: MediaPurpose.Avatar,
        scanStatus: MediaScanStatus.Pending,
        byteSize: 2048,
      },
    );
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValueOnce([]);
    await expect(repo.insert(scope as never, NEW_ASSET)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('finds a media asset by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([mediaRow({ scan_status: 'clean' })]);
    await expect(
      repo.findById(scope as never, 'team-1', 'mem-1', 'md-1'),
    ).resolves.toMatchObject({ scanStatus: MediaScanStatus.Clean });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.findById(scope as never, 'team-1', 'mem-1', 'ghost'),
    ).resolves.toBeNull();
  });

  it('updates the scan status or returns null when missing', async () => {
    scope.run.mockResolvedValueOnce([mediaRow({ scan_status: 'infected' })]);
    await expect(
      repo.updateScanStatus(scope as never, 'md-1', MediaScanStatus.Infected),
    ).resolves.toMatchObject({ scanStatus: MediaScanStatus.Infected });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repo.updateScanStatus(scope as never, 'ghost', MediaScanStatus.Clean),
    ).resolves.toBeNull();
  });
});
