import { ApiProperty } from '@core/openapi';

import { SessionResponseDto } from './session-response.dto';

export class GenerationResultResponseDto {
  @ApiProperty({ description: 'Sessions newly created by this run' })
  declare readonly created: number;

  @ApiProperty({
    description: 'Occurrences already present and left untouched',
  })
  declare readonly skipped: number;

  @ApiProperty({ type: [SessionResponseDto] })
  declare readonly sessions: readonly SessionResponseDto[];
}
