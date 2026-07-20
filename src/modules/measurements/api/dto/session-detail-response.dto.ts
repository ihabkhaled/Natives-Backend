import { ApiProperty } from '@core/openapi';

import { AttemptResponseDto } from './attempt-response.dto';
import { MeasurementSessionResponseDto } from './session-response.dto';

/** A measurement session with the full list of attempts recorded in it. */
export class SessionDetailResponseDto {
  @ApiProperty({ type: MeasurementSessionResponseDto })
  declare readonly session: MeasurementSessionResponseDto;

  @ApiProperty({ type: [AttemptResponseDto] })
  declare readonly attempts: readonly AttemptResponseDto[];
}
