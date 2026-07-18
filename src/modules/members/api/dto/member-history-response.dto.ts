import { ApiProperty } from '@core/openapi';

import { MembershipStatus } from '../../model/members.enums';

/** One immutable lifecycle-transition record. */
export class StatusEventResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: MembershipStatus, nullable: true })
  declare readonly fromStatus: MembershipStatus | null;

  @ApiProperty({ enum: MembershipStatus })
  declare readonly toStatus: MembershipStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly occurredAt: Date;
}

/** The append-only status-history timeline for a membership. */
export class MemberHistoryResponseDto {
  @ApiProperty({ type: [StatusEventResponseDto] })
  declare readonly items: readonly StatusEventResponseDto[];
}
