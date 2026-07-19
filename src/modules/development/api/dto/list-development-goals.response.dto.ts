import { ApiProperty } from '@core/openapi';

import { DevelopmentGoalResponseDto } from './development-goal-response.dto';

/** A bounded page of development goals with their action plans. */
export class ListDevelopmentGoalsResponseDto {
  @ApiProperty({ type: [DevelopmentGoalResponseDto] })
  declare readonly items: readonly DevelopmentGoalResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
