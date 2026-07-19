import { ApiProperty } from '@core/openapi';

import { AttemptResponseDto } from './attempt-response.dto';
import { ProtocolResponseDto } from './protocol-response.dto';
import { ResultSelectionResponseDto } from './result-selection.response.dto';

/** Acknowledgement of a recorded measurement: the attempts and derived result. */
export class RecordedMeasurementResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly sessionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: ProtocolResponseDto })
  declare readonly protocol: ProtocolResponseDto;

  @ApiProperty({ type: [AttemptResponseDto] })
  declare readonly attempts: readonly AttemptResponseDto[];

  @ApiProperty({ type: ResultSelectionResponseDto })
  declare readonly result: ResultSelectionResponseDto;
}
