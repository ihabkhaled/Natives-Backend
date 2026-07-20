import { ApiProperty } from '@core/openapi';

import { RoundResponseDto } from './round-response.dto';
import { StageResponseDto } from './stage-response.dto';

/** The ordered stage/round structure of a competition. */
export class StructureResponseDto {
  @ApiProperty({ type: [StageResponseDto] })
  declare readonly stages: readonly StageResponseDto[];

  @ApiProperty({ type: [RoundResponseDto] })
  declare readonly rounds: readonly RoundResponseDto[];
}
