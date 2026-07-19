import { ApiProperty } from '@core/openapi';

import { AttemptResponseDto } from './attempt-response.dto';
import { SessionResponseDto } from './session-response.dto';

/** A measurement session with the full list of attempts recorded in it. */
export class SessionDetailResponseDto {
  @ApiProperty({ type: SessionResponseDto })
  declare readonly session: SessionResponseDto;

  @ApiProperty({ type: [AttemptResponseDto] })
  declare readonly attempts: readonly AttemptResponseDto[];
}
