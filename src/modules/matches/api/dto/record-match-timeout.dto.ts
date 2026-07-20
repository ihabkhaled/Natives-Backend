import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
} from '../../model/matches.constants';
import { ScoringSide } from '../../model/matches.enums';

/**
 * Request body to record a timeout. Idempotent on the client operation id, like
 * a point. The allowance is read from the match's versioned ruleset and a side
 * that has spent its budget is refused, never quietly granted an extra one.
 */
export class RecordMatchTimeoutDto {
  @ApiProperty({
    minLength: OPERATION_ID_MIN_LENGTH,
    maxLength: OPERATION_ID_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_ID_MIN_LENGTH)
  @MaxLength(OPERATION_ID_MAX_LENGTH)
  declare readonly operationId: string;

  @ApiProperty({ enum: ScoringSide })
  @IsEnum(ScoringSide)
  declare readonly scoringSide: ScoringSide;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly occurredAt?: string | null;
}
