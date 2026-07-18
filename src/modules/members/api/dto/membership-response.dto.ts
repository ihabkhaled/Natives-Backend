import { ApiProperty } from '@core/openapi';

import { MembershipStatus } from '../../model/members.enums';

/** Lifecycle view of a membership returned by invite/transition/anonymize. */
export class MembershipResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly userId: string | null;

  @ApiProperty({ enum: MembershipStatus })
  declare readonly status: MembershipStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly statusReason: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly statusEffectiveAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly joinedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly leftAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly anonymizedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly updatedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly deletedAt: Date | null;

  @ApiProperty()
  declare readonly version: number;
}
