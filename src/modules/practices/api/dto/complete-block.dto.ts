import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsEnum, IsInt, IsOptional, Min } from '@core/validation';

import { CompletionStatus } from '../../model/agendas.enums';
import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';

/** Body for recording a block's execution/completion during or after a session. */
export class CompleteBlockDto {
  @ApiProperty({ enum: CompletionStatus })
  @IsEnum(CompletionStatus)
  declare readonly completionStatus: CompletionStatus;

  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
