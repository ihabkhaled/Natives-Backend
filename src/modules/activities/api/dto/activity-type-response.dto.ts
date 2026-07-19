import { ApiProperty } from '@core/openapi';

import {
  ACTIVITY_CATEGORY_VALUES,
  type ActivityCategory,
  POINTS_APPROVAL_VALUES,
  type PointsApproval,
} from '../../model/activity.enums';

/**
 * A versioned activity-type catalog entry. `defaultPointValue` is a CANDIDATE:
 * null with `pointsApproval` pending for WFDF/custom types until a rules owner
 * approves it.
 */
export class ActivityTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty()
  declare readonly typeKey: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly description: string;

  @ApiProperty({ enum: ACTIVITY_CATEGORY_VALUES })
  declare readonly category: ActivityCategory;

  @ApiProperty({ type: String, nullable: true })
  declare readonly unit: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly defaultPointValue: number | null;

  @ApiProperty({ enum: POINTS_APPROVAL_VALUES })
  declare readonly pointsApproval: PointsApproval;

  @ApiProperty()
  declare readonly requiresEvidence: boolean;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly minDurationMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly maxDurationMinutes: number | null;

  @ApiProperty()
  declare readonly catalogVersion: number;
}
