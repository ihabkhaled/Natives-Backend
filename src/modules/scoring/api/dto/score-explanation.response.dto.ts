import { ApiProperty } from '@core/openapi';

import { ScoreConfidence } from '../../model/scoring.enums';
import { OverallExplanationResponseDto } from './overall-explanation.response.dto';
import { ScoreComponentResponseDto } from './score-component.response.dto';
import { ScoreRuleReferenceResponseDto } from './score-rule-reference.response.dto';

/**
 * The self-contained explanation of a projected score: the rule version, the
 * overall arithmetic (numerator/denominator/excluded, unrounded and displayed),
 * each component, and the completeness/confidence indicators.
 */
export class ScoreExplanationResponseDto {
  @ApiProperty({ type: ScoreRuleReferenceResponseDto })
  declare readonly rule: ScoreRuleReferenceResponseDto;

  @ApiProperty({ type: OverallExplanationResponseDto })
  declare readonly overall: OverallExplanationResponseDto;

  @ApiProperty({ type: [ScoreComponentResponseDto] })
  declare readonly components: readonly ScoreComponentResponseDto[];

  @ApiProperty()
  declare readonly completeness: number;

  @ApiProperty({ enum: ScoreConfidence })
  declare readonly confidence: ScoreConfidence;

  @ApiProperty()
  declare readonly formulaVersion: number;
}
