import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  ACTION_SORT_MAX,
  ACTION_SORT_MIN,
  ACTION_TEXT_MAX_LENGTH,
  ISO_DATE_PATTERN,
} from '../../model/development.constants';

/** A single action-plan step attached to a development goal. */
export class GoalActionDto {
  @ApiProperty({ minLength: 1, maxLength: ACTION_TEXT_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(ACTION_TEXT_MAX_LENGTH)
  declare readonly description: string;

  @ApiProperty({ minimum: ACTION_SORT_MIN, maximum: ACTION_SORT_MAX })
  @IsInt()
  @Min(ACTION_SORT_MIN)
  @Max(ACTION_SORT_MAX)
  declare readonly sortOrder: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly done?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN)
  readonly dueDate?: string | null;
}
