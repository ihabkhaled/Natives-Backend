import { ApiProperty } from '@core/openapi';
import { IsString, IsUUID, MaxLength, MinLength } from '@core/validation';

import {
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/matches.constants';

/**
 * Request body to retract a recorded fact. The original row is never deleted or
 * rewritten — this appends a compensating correction that carries an explicit
 * reason, so the stream stays a complete history and the statistics stay a
 * projection of it.
 */
export class CorrectMatchPlayDto {
  @ApiProperty({
    minLength: OPERATION_ID_MIN_LENGTH,
    maxLength: OPERATION_ID_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_ID_MIN_LENGTH)
  @MaxLength(OPERATION_ID_MAX_LENGTH)
  declare readonly operationId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly playId: string;

  @ApiProperty({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;
}
