import { ApiProperty } from '@core/openapi';

import {
  ConstraintCode,
  ConstraintSeverity,
  RosterStatus,
} from '../../model/rosters.enums';

/** One explainable constraint outcome. `count` is null when not measurable. */
export class RosterConstraintViolationDto {
  @ApiProperty({ enum: ConstraintCode })
  declare readonly code: ConstraintCode;

  @ApiProperty({ enum: ConstraintSeverity })
  declare readonly severity: ConstraintSeverity;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly count: number | null;
}

/** The counted shape of a roster's active entries. */
export class RosterCompositionDto {
  @ApiProperty()
  declare readonly selected: number;

  @ApiProperty()
  declare readonly women: number;

  @ApiProperty()
  declare readonly men: number;

  @ApiProperty()
  declare readonly mixed: number;

  @ApiProperty()
  declare readonly unknownGender: number;

  @ApiProperty()
  declare readonly offense: number;

  @ApiProperty()
  declare readonly defense: number;

  @ApiProperty()
  declare readonly flexible: number;

  @ApiProperty()
  declare readonly captains: number;

  @ApiProperty()
  declare readonly spiritCaptains: number;

  @ApiProperty()
  declare readonly missingJersey: number;

  @ApiProperty()
  declare readonly duplicateJerseys: number;

  @ApiProperty()
  declare readonly unavailableSelected: number;
}

/**
 * The server-side validation preview of a roster, produced by the SAME rules
 * enforced at publish and lock. Errors block freezing; warnings never do.
 */
export class RosterValidationResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly rosterId: string;

  @ApiProperty()
  declare readonly policyVersion: string;

  @ApiProperty({ enum: RosterStatus })
  declare readonly status: RosterStatus;

  @ApiProperty({ type: RosterCompositionDto })
  declare readonly composition: RosterCompositionDto;

  @ApiProperty({ type: [RosterConstraintViolationDto] })
  declare readonly violations: readonly RosterConstraintViolationDto[];

  @ApiProperty()
  declare readonly publishable: boolean;
}
