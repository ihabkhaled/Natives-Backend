import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  ACTIONS_MAX_ITEMS,
  GOAL_NUMERIC_MAX,
  GOAL_NUMERIC_MIN,
  GOAL_TEXT_MAX_LENGTH,
  GOAL_TITLE_MAX_LENGTH,
  GOAL_TITLE_MIN_LENGTH,
  ISO_DATE_PATTERN,
  RECORD_VERSION_MIN,
} from '../../model/development.constants';
import { GoalActionDto } from './goal-action.dto';

/** Request body to update a goal's content and replace its action plan. */
export class UpdateGoalDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly feedbackId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly metricDefinitionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly ownerUserId?: string | null;

  @ApiProperty({
    minLength: GOAL_TITLE_MIN_LENGTH,
    maxLength: GOAL_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(GOAL_TITLE_MIN_LENGTH)
  @MaxLength(GOAL_TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly description?: string | null;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly measurableTarget?: string | null;

  @ApiPropertyOptional({
    minimum: GOAL_NUMERIC_MIN,
    maximum: GOAL_NUMERIC_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(GOAL_NUMERIC_MIN)
  @Max(GOAL_NUMERIC_MAX)
  readonly targetValue?: number | null;

  @ApiPropertyOptional({
    minimum: GOAL_NUMERIC_MIN,
    maximum: GOAL_NUMERIC_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(GOAL_NUMERIC_MIN)
  @Max(GOAL_NUMERIC_MAX)
  readonly baselineValue?: number | null;

  @ApiPropertyOptional({
    minimum: GOAL_NUMERIC_MIN,
    maximum: GOAL_NUMERIC_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(GOAL_NUMERIC_MIN)
  @Max(GOAL_NUMERIC_MAX)
  readonly progressValue?: number | null;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly progressNote?: string | null;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly evidence?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN)
  readonly dueDate?: string | null;

  @ApiPropertyOptional({ type: [GoalActionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ACTIONS_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => GoalActionDto)
  readonly actions?: readonly GoalActionDto[];
}
