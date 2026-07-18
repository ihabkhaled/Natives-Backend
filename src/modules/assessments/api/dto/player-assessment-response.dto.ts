import { ApiProperty } from '@core/openapi';

import { PlayerAssessmentRecordResponseDto } from './player-assessment-record-response.dto';
import { PlayerAssessmentValueResponseDto } from './player-assessment-value-response.dto';

/** A player assessment with its ordered per-metric values (team detail view). */
export class PlayerAssessmentResponseDto {
  @ApiProperty({ type: PlayerAssessmentRecordResponseDto })
  declare readonly assessment: PlayerAssessmentRecordResponseDto;

  @ApiProperty({ type: [PlayerAssessmentValueResponseDto] })
  declare readonly values: readonly PlayerAssessmentValueResponseDto[];
}
