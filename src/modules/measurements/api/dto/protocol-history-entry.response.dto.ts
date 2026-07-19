import { ApiProperty } from '@core/openapi';

import { AttemptResponseDto } from './attempt-response.dto';
import { ProtocolResponseDto } from './protocol-response.dto';
import { ResultSelectionResponseDto } from './result-selection.response.dto';

/** One protocol's attempts for a player, with its derived best/average result. */
export class ProtocolHistoryEntryResponseDto {
  @ApiProperty({ type: ProtocolResponseDto })
  declare readonly protocol: ProtocolResponseDto;

  @ApiProperty({ type: [AttemptResponseDto] })
  declare readonly attempts: readonly AttemptResponseDto[];

  @ApiProperty({ type: ResultSelectionResponseDto })
  declare readonly result: ResultSelectionResponseDto;
}
