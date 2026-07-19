import { ApiProperty } from '@core/openapi';

import { ScoreExplanationResponseDto } from './score-explanation.response.dto';

/**
 * A dry-run comparison of a rule against one member's live facts and the effective
 * published rule. Written to nothing — a preview only.
 */
export class SimulationResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: ScoreExplanationResponseDto })
  declare readonly draft: ScoreExplanationResponseDto;

  @ApiProperty({ type: ScoreExplanationResponseDto, nullable: true })
  declare readonly published: ScoreExplanationResponseDto | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly delta: number | null;
}
