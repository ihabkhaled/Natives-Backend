import { ApiProperty } from '@core/openapi';

/** A round within a stage of a competition. */
export class RoundResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly roundId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly stageId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly ordinal: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
