import { ApiProperty } from '@core/openapi';

import {
  AvailabilityStatus,
  SignalCode,
  SignalStatus,
} from '../../model/squads.enums';

/** One explainable, advisory eligibility signal outcome for a candidate. */
export class EligibilitySignalDto {
  @ApiProperty({ enum: SignalCode })
  declare readonly code: SignalCode;

  @ApiProperty({ enum: SignalStatus })
  declare readonly status: SignalStatus;
}

/** A candidate's advisory eligibility evaluation under the named policy version. */
export class MemberEligibilityDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly fullName: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly jerseyNumber: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly attendancePct: number | null;

  @ApiProperty({ enum: AvailabilityStatus, nullable: true })
  declare readonly availability: AvailabilityStatus | null;

  @ApiProperty()
  declare readonly selected: boolean;

  @ApiProperty({ type: [EligibilitySignalDto] })
  declare readonly signals: readonly EligibilitySignalDto[];

  @ApiProperty({ enum: SignalStatus })
  declare readonly overall: SignalStatus;

  @ApiProperty()
  declare readonly flagged: boolean;
}

/** Advisory gender-ratio balance of the selected players. */
export class GenderRatioDto {
  @ApiProperty()
  declare readonly men: number;

  @ApiProperty()
  declare readonly women: number;

  @ApiProperty()
  declare readonly mixed: number;

  @ApiProperty()
  declare readonly unknown: number;

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly balanced: boolean;
}

/**
 * The advisory eligibility report for a squad's candidate pool: per-candidate
 * signals under a named policy version, plus the selected-players gender ratio.
 * Nothing here excludes a player — the signals inform an authorized human.
 */
export class EligibilityReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly squadId: string;

  @ApiProperty()
  declare readonly policyVersion: string;

  @ApiProperty()
  declare readonly attendanceThresholdPct: number;

  @ApiProperty({ type: [MemberEligibilityDto] })
  declare readonly candidates: readonly MemberEligibilityDto[];

  @ApiProperty({ type: GenderRatioDto })
  declare readonly selectedGenderRatio: GenderRatioDto;

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
