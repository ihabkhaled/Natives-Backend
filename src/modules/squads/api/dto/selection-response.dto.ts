import { ApiProperty } from '@core/openapi';

import { SelectionRole, SelectionStatus } from '../../model/squads.enums';

/**
 * A squad selection with its eligibility snapshot and override evidence. The
 * snapshot is a compact, privacy-safe classification (overall outcome + flagged
 * signal codes) — never any medical detail.
 */
export class SelectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly selectionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly squadId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: SelectionRole })
  declare readonly selectionRole: SelectionRole;

  @ApiProperty({ enum: SelectionStatus })
  declare readonly status: SelectionStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty()
  declare readonly eligibilityOverridden: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly overrideReason: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly overriddenBy: string | null;

  @ApiProperty()
  declare readonly eligibilitySnapshot: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly selectedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly removedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly removedAt: Date | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
