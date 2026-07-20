import { ApiProperty } from '@core/openapi';

import { StageFormat } from '../../model/competitions.enums';

/** A stage of a competition. */
export class StageResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly stageId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: StageFormat })
  declare readonly stageFormat: StageFormat;

  @ApiProperty()
  declare readonly ordinal: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
