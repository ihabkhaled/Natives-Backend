import { ApiProperty } from '@core/openapi';

import {
  BUDDY_STATUS_VALUES,
  type BuddyStatus,
} from '../../model/activity.enums';

/** A credited training buddy with its confirmation state. */
export class BuddyResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly submissionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: BUDDY_STATUS_VALUES })
  declare readonly status: BuddyStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly respondedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: string;
}
