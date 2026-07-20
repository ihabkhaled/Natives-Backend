import { ApiProperty } from '@core/openapi';
import { IsString, IsUUID, MaxLength, MinLength } from '@core/validation';

import {
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/matches.constants';

/**
 * Request body to undo a recorded fact by appending a compensating void. The
 * original event is never deleted or rewritten, and the reason is mandatory —
 * a live correction is evidence, not an erasure.
 */
export class VoidMatchEventDto {
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
  declare readonly eventId: string;

  @ApiProperty({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;
}
