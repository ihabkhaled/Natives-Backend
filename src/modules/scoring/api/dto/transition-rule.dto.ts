import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/scoring.constants';
import { CalculationRuleTransition } from '../../model/scoring.enums';

/** Request body to move a calculation rule through its lifecycle. */
export class TransitionRuleDto {
  @ApiProperty({ enum: CalculationRuleTransition })
  @IsEnum(CalculationRuleTransition)
  declare readonly transition: CalculationRuleTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
