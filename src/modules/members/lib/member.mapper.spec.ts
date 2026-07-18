import { describe, expect, it } from 'vitest';

import {
  AliasSource,
  MediaPurpose,
  MediaScanStatus,
} from '../model/members.enums';
import type { MediaAsset, MemberAlias } from '../model/members.types';
import {
  toAliasResponse,
  toListAliasesResponse,
  toMediaAssetResponse,
} from './member.mapper';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const ALIAS: MemberAlias = {
  id: 'al-1',
  membershipId: 'mem-1',
  teamId: 'team-1',
  alias: 'Speedy',
  normalizedAlias: 'speedy',
  source: AliasSource.Manual,
  createdBy: 'admin-1',
  createdAt: NOW,
  deletedAt: null,
};

const ASSET: MediaAsset = {
  id: 'md-1',
  teamId: 'team-1',
  membershipId: 'mem-1',
  purpose: MediaPurpose.Avatar,
  storageKey: 'teams/team-1/mem-1/md-1',
  contentType: 'image/png',
  byteSize: 2048,
  width: 256,
  height: 256,
  scanStatus: MediaScanStatus.Clean,
  createdBy: 'admin-1',
  createdAt: NOW,
  deletedAt: null,
};

describe('member.mapper', () => {
  it('projects an alias without the normalized key or soft-delete state', () => {
    const response = toAliasResponse(ALIAS);
    expect(response).toEqual({
      id: 'al-1',
      membershipId: 'mem-1',
      alias: 'Speedy',
      source: AliasSource.Manual,
      createdAt: NOW,
    });
    expect('normalizedAlias' in response).toBe(false);
    expect('deletedAt' in response).toBe(false);
  });

  it('projects an alias list', () => {
    expect(toListAliasesResponse([ALIAS]).items).toHaveLength(1);
  });

  it('projects a media asset without the private storage key', () => {
    const response = toMediaAssetResponse(ASSET);
    expect('storageKey' in response).toBe(false);
    expect(response.scanStatus).toBe(MediaScanStatus.Clean);
    expect(response.byteSize).toBe(2048);
  });
});
