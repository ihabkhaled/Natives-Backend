import { ApiProperty } from '@core/openapi';

import { DevelopmentGoalRecordResponseDto } from './development-goal-record-response.dto';
import { GoalActionResponseDto } from './goal-action-response.dto';

/** A development goal with its ordered action-plan steps. */
export class DevelopmentGoalResponseDto {
  @ApiProperty({ type: DevelopmentGoalRecordResponseDto })
  declare readonly goal: DevelopmentGoalRecordResponseDto;

  @ApiProperty({ type: [GoalActionResponseDto] })
  declare readonly actions: readonly GoalActionResponseDto[];
}
