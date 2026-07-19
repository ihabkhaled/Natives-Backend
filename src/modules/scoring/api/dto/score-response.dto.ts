import { ApiProperty } from '@core/openapi';

import {
  ScoreConfidence,
  ScoreProjectionStatus,
} from '../../model/scoring.enums';
import { ScoreExplanationResponseDto } from './score-explanation.response.dto';

/** A performance-score projection with its explanation. */
export class ScoreResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly periodId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty()
  declare readonly ruleKey: string;

  @ApiProperty()
  declare readonly ruleVersion: number;

  @ApiProperty({ enum: ScoreProjectionStatus })
  declare readonly status: ScoreProjectionStatus;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly value: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly numerator: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly denominator: number | null;

  @ApiProperty()
  declare readonly includedCount: number;

  @ApiProperty()
  declare readonly excludedCount: number;

  @ApiProperty()
  declare readonly completeness: number;

  @ApiProperty({ enum: ScoreConfidence })
  declare readonly confidence: ScoreConfidence;

  @ApiProperty({ type: ScoreExplanationResponseDto, nullable: true })
  declare readonly explanation: ScoreExplanationResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly sourceHash: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly error: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly computedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
