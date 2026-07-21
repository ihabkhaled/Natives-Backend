import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/points.constants';
import { PointsRuleTransition } from '../../model/points.enums';

/** Request body to move a points rule through its lifecycle. */
export class PointsTransitionRuleDto {
  @ApiProperty({ enum: PointsRuleTransition })
  @IsEnum(PointsRuleTransition)
  declare readonly transition: PointsRuleTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
