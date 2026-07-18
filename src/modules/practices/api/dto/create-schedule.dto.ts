import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  DATE_PATTERN,
  DURATION_MINUTES_MAX,
  DURATION_MINUTES_MIN,
  EXCEPTIONS_MAX_COUNT,
  FIELD_MAX_LENGTH,
  INTERVAL_WEEKS_MAX,
  INTERVAL_WEEKS_MIN,
  LOCAL_TIME_PATTERN,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  OFFSET_MINUTES_MAX,
  OFFSET_MINUTES_MIN,
  SESSION_TYPE_MAX_LENGTH,
  SESSION_TYPE_MIN_LENGTH,
  TIMEZONE_MAX_LENGTH,
  WEEKDAY_MAX,
  WEEKDAY_MIN,
  WEEKDAYS_MAX_COUNT,
} from '../../model/practices.constants';
import {
  RecurrenceFrequency,
  SessionVisibility,
} from '../../model/practices.enums';

export class CreateScheduleDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly seasonId?: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiProperty({
    minLength: SESSION_TYPE_MIN_LENGTH,
    maxLength: SESSION_TYPE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(SESSION_TYPE_MIN_LENGTH)
  @MaxLength(SESSION_TYPE_MAX_LENGTH)
  declare readonly sessionType: string;

  @ApiPropertyOptional({ maxLength: TIMEZONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone?: string;

  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  declare readonly frequency: RecurrenceFrequency;

  @ApiPropertyOptional({
    minimum: INTERVAL_WEEKS_MIN,
    maximum: INTERVAL_WEEKS_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(INTERVAL_WEEKS_MIN)
  @Max(INTERVAL_WEEKS_MAX)
  declare readonly intervalWeeks?: number;

  @ApiPropertyOptional({ type: [Number], maxItems: WEEKDAYS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(WEEKDAYS_MAX_COUNT)
  @IsInt({ each: true })
  @Min(WEEKDAY_MIN, { each: true })
  @Max(WEEKDAY_MAX, { each: true })
  declare readonly weekdays?: readonly number[];

  @ApiProperty({ pattern: LOCAL_TIME_PATTERN.source })
  @IsString()
  @Matches(LOCAL_TIME_PATTERN)
  declare readonly startTimeLocal: string;

  @ApiProperty({ minimum: DURATION_MINUTES_MIN, maximum: DURATION_MINUTES_MAX })
  @IsInt()
  @Min(DURATION_MINUTES_MIN)
  @Max(DURATION_MINUTES_MAX)
  declare readonly durationMinutes: number;

  @ApiPropertyOptional({
    minimum: OFFSET_MINUTES_MIN,
    maximum: OFFSET_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(OFFSET_MINUTES_MIN)
  @Max(OFFSET_MINUTES_MAX)
  declare readonly meetOffsetMinutes?: number;

  @ApiPropertyOptional({
    minimum: OFFSET_MINUTES_MIN,
    maximum: OFFSET_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(OFFSET_MINUTES_MIN)
  @Max(OFFSET_MINUTES_MAX)
  declare readonly rsvpCutoffMinutes?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly defaultVenueId?: string;

  @ApiPropertyOptional({ maxLength: FIELD_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX_LENGTH)
  declare readonly defaultField?: string;

  @ApiPropertyOptional({ minimum: CAPACITY_MIN, maximum: CAPACITY_MAX })
  @IsOptional()
  @IsInt()
  @Min(CAPACITY_MIN)
  @Max(CAPACITY_MAX)
  declare readonly defaultCapacity?: number;

  @ApiPropertyOptional({ enum: SessionVisibility })
  @IsOptional()
  @IsEnum(SessionVisibility)
  declare readonly visibility?: SessionVisibility;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly organizerUserId?: string;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  declare readonly notes?: string;

  @ApiProperty({ pattern: DATE_PATTERN.source })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly generationStart: string;

  @ApiProperty({ pattern: DATE_PATTERN.source })
  @IsString()
  @Matches(DATE_PATTERN)
  declare readonly generationUntil: string;

  @ApiPropertyOptional({ type: [String], maxItems: EXCEPTIONS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EXCEPTIONS_MAX_COUNT)
  @IsString({ each: true })
  @Matches(DATE_PATTERN, { each: true })
  declare readonly exceptions?: readonly string[];
}
