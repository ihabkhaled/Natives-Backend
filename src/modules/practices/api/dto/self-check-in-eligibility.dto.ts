import { ApiProperty } from '@core/openapi';

import { SelfCheckInState } from '../../model/attendance.enums';

/**
 * The server-owned self check-in eligibility on the own-attendance read: the
 * explicit UTC window bounds (opens `startsAt − 60 min`, closes at the session
 * end) plus the resolved state — `not_open`/`open`/`closed` from the window,
 * `locked` when the sheet is finalized/corrected, `recorded` when a record
 * already exists. Clients render this; they never re-implement the rule.
 */
export class SelfCheckInEligibilityDto {
  @ApiProperty({ enum: SelfCheckInState })
  declare readonly state: SelfCheckInState;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly opensAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly closesAt: Date;
}
