import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  LINE_SIZE_MAX,
  LINE_SIZE_MIN,
  NOTES_MAX_LENGTH,
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
} from '../../model/matches.constants';
import { PointStartingLine } from '../../model/matches.enums';

/**
 * Request body to open a point by recording the line that took the field.
 *
 * `startingLine` is the only input that decides hold versus break, and
 * `lineMembershipIds` is the ONLY source of points played — both are recorded as
 * facts here rather than inferred later. The operation id makes the write
 * idempotent: replaying it returns the stored point and its stored line, while
 * the same id carrying a different line is a 409, never a silent rewrite.
 */
export class StartMatchPointDto {
  @ApiProperty({
    minLength: OPERATION_ID_MIN_LENGTH,
    maxLength: OPERATION_ID_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_ID_MIN_LENGTH)
  @MaxLength(OPERATION_ID_MAX_LENGTH)
  declare readonly operationId: string;

  @ApiProperty({ enum: PointStartingLine })
  @IsEnum(PointStartingLine)
  declare readonly startingLine: PointStartingLine;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(LINE_SIZE_MIN)
  @ArrayMaxSize(LINE_SIZE_MAX)
  @IsUUID(undefined, { each: true })
  declare readonly lineMembershipIds: readonly string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly pullerMembershipId?: string | null;

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
