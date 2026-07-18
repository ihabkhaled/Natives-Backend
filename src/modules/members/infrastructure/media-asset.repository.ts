import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMediaAsset } from '../lib/members.helpers';
import { MEDIA_ASSET_COLUMNS as MEDIA_COLUMNS } from '../model/members.constants';
import type { MediaScanStatus } from '../model/members.enums';
import type { MediaAssetRow } from '../model/members.rows';
import type { MediaAsset, NewMediaAsset } from '../model/members.types';

/**
 * Persistence for media asset metadata. Only metadata lives here — bytes are held
 * in object storage behind the media port, never in the database. Data access
 * only: parameterized SQL, static column lists, scan-state transitions.
 */
@Injectable()
export class MediaAssetRepository {
  async insert(
    scope: TransactionScope,
    asset: NewMediaAsset,
  ): Promise<MediaAsset> {
    const rows = await scope.run<MediaAssetRow>(
      `INSERT INTO "media_assets" ("id", "team_id", "membership_id", "purpose",
              "storage_key", "content_type", "byte_size", "width", "height",
              "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${MEDIA_COLUMNS}`,
      [
        asset.id,
        asset.teamId,
        asset.membershipId,
        asset.purpose,
        asset.storageKey,
        asset.contentType,
        asset.byteSize,
        asset.width,
        asset.height,
        asset.createdBy,
        asset.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the media write');
    }
    return toMediaAsset(row);
  }

  async findById(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    mediaId: string,
  ): Promise<MediaAsset | null> {
    const rows = await scope.run<MediaAssetRow>(
      `SELECT ${MEDIA_COLUMNS} FROM "media_assets"
        WHERE "id" = $1 AND "team_id" = $2 AND "membership_id" = $3
          AND "deleted_at" IS NULL`,
      [mediaId, teamId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toMediaAsset(row);
  }

  async updateScanStatus(
    scope: TransactionScope,
    mediaId: string,
    scanStatus: MediaScanStatus,
  ): Promise<MediaAsset | null> {
    const rows = await scope.run<MediaAssetRow>(
      `UPDATE "media_assets" SET "scan_status" = $2
        WHERE "id" = $1 AND "deleted_at" IS NULL
       RETURNING ${MEDIA_COLUMNS}`,
      [mediaId, scanStatus],
    );
    const row = rows[0];
    return row === undefined ? null : toMediaAsset(row);
  }
}
