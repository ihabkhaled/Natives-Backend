import { ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from '@core/validation';

import { SESSION_TYPE_MAX_LENGTH } from '../../model/practices.constants';
import { SessionStatus } from '../../model/practices.enums';
import { PracticeListQueryDto } from './list-query.dto';

/**
 * Calendar/list filter for practice sessions. All dimensions are optional and
 * allowlisted; the window bounds filter on the start instant. Absent dimensions
 * are unfiltered. Pagination is inherited and clamped.
 */
export class ListSessionsQueryDto extends PracticeListQueryDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  readonly to?: string;

  @ApiPropertyOptional({ enum: SessionStatus })
  @IsOptional()
  @IsEnum(SessionStatus)
  readonly status?: SessionStatus;

  @ApiPropertyOptional({ maxLength: SESSION_TYPE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(SESSION_TYPE_MAX_LENGTH)
  readonly sessionType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
