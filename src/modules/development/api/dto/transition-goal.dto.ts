import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/development.constants';
import { GoalTransition } from '../../model/goal.enums';

/** Request body to move a development goal through its lifecycle. */
export class TransitionGoalDto {
  @ApiProperty({ enum: GoalTransition })
  @IsEnum(GoalTransition)
  declare readonly transition: GoalTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
