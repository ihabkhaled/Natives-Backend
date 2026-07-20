import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsDateString, IsEnum, IsOptional, IsUUID } from '@core/validation';

import { MatchSide } from '../../model/competitions.enums';

/**
 * Request body for booking a fixture against a catalogued opponent. The instant is
 * an ISO 8601 timestamp with an offset (stored UTC, presented in Africa/Cairo).
 * Stage and round are optional but, when supplied, must belong to the competition.
 */
export class CreateFixtureDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly opponentId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly stageId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly roundId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly venueId?: string | null;

  @ApiProperty({ enum: MatchSide })
  @IsEnum(MatchSide)
  declare readonly homeAway: MatchSide;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly scheduledAt: string;
}
