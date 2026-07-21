import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  NOTES_MAX_LENGTH,
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
} from '../../model/matches.constants';
import { AssistState, MatchPlayType } from '../../model/matches.enums';

/**
 * Request body for one possession fact inside the open point.
 *
 * `assistState` is the explicit Callahan / no-assist / unknown distinction: a
 * goal with `none` is a MEASURED "there was no assist" and one with `unknown` is
 * missing data that is never invented into an assist for anyone.
 */
export class RecordMatchPlayDto {
  @ApiProperty({
    minLength: OPERATION_ID_MIN_LENGTH,
    maxLength: OPERATION_ID_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_ID_MIN_LENGTH)
  @MaxLength(OPERATION_ID_MAX_LENGTH)
  declare readonly operationId: string;

  @ApiProperty({ enum: MatchPlayType })
  @IsEnum(MatchPlayType)
  declare readonly playType: MatchPlayType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly primaryMembershipId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly secondaryMembershipId?: string | null;

  @ApiPropertyOptional({ enum: AssistState, default: AssistState.Unknown })
  @IsOptional()
  @IsEnum(AssistState)
  readonly assistState?: AssistState | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly callahan?: boolean | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly occurredAt?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
