import type {
  AliasResponse,
  ListAliasesResponse,
  MediaAsset,
  MediaAssetResponse,
  MemberAlias,
} from '../model/members.types';

/**
 * Response projections for the members module. These strip internal-only fields
 * (the normalized alias key, the private object-storage key, soft-delete state,
 * team/actor columns) so the transport layer never leaks persistence details.
 */

export function toAliasResponse(alias: MemberAlias): AliasResponse {
  return {
    id: alias.id,
    membershipId: alias.membershipId,
    alias: alias.alias,
    source: alias.source,
    createdAt: alias.createdAt,
  };
}

export function toListAliasesResponse(
  aliases: readonly MemberAlias[],
): ListAliasesResponse {
  return { items: aliases.map(alias => toAliasResponse(alias)) };
}

export function toMediaAssetResponse(asset: MediaAsset): MediaAssetResponse {
  return {
    id: asset.id,
    membershipId: asset.membershipId,
    purpose: asset.purpose,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    scanStatus: asset.scanStatus,
    createdAt: asset.createdAt,
  };
}
