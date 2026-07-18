import { ApiProperty } from '@core/openapi';

import { AttendanceRuleStatus } from '../../model/attendance.enums';

/**
 * Raw participation INPUTS for one member, projected from finalized facts against a
 * cited rule version. Every count and the (unrounded) rate + points contribution is
 * reproducible from these fields; `attendanceRate`/`pointsContribution` are null for
 * "not enough data" — distinct from a measured zero. This is not a stored total.
 */
export class ParticipationResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly ruleVersion: string;

  @ApiProperty({ enum: AttendanceRuleStatus })
  declare readonly ruleStatus: AttendanceRuleStatus;

  @ApiProperty()
  declare readonly eligibleSessions: number;

  @ApiProperty()
  declare readonly attended: number;

  @ApiProperty()
  declare readonly onTime: number;

  @ApiProperty()
  declare readonly late: number;

  @ApiProperty()
  declare readonly excused: number;

  @ApiProperty()
  declare readonly injured: number;

  @ApiProperty()
  declare readonly absent: number;

  @ApiProperty()
  declare readonly remoteApproved: number;

  @ApiProperty()
  declare readonly otherApproved: number;

  @ApiProperty()
  declare readonly excludedSessions: number;

  @ApiProperty()
  declare readonly denominator: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly attendanceRate: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly attendanceRatePercent: number | null;

  @ApiProperty()
  declare readonly weightedPresentPoints: number;

  @ApiProperty()
  declare readonly latePenaltyPoints: number;

  @ApiProperty()
  declare readonly absentPenaltyPoints: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly pointsContribution: number | null;
}
