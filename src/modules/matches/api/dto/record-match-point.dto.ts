import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
  POINTS_MAX,
  POINTS_MIN,
  STREAM_VERSION_MIN,
} from '../../model/matches.constants';
import { ScoringSide } from '../../model/matches.enums';

/**
 * Request body to record one point.
 *
 * `operationId` is the CLIENT operation id and is the whole offline contract:
 * replaying the same id with the same payload returns the same authoritative
 * outcome and changes the score exactly once, while the same id carrying a
 * different payload is refused as a conflict. `expectedStreamVersion` optionally
 * pins the base version the device scored against, so a stale queue is rejected
 * rather than applied out of order. The scorer is optional — an unattributed
 * point stays NULL and is never credited to anyone.
 */
export class RecordMatchPointDto {
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

  @ApiPropertyOptional({
    minimum: POINTS_MIN,
    maximum: POINTS_MAX,
    default: POINTS_MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(POINTS_MIN)
  @Max(POINTS_MAX)
  readonly points?: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly scorerMembershipId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly assistMembershipId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly occurredAt?: string | null;

  @ApiPropertyOptional({ minimum: STREAM_VERSION_MIN, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(STREAM_VERSION_MIN)
  readonly expectedStreamVersion?: number | null;
}
