import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

import { PracticeListQueryDto } from './list-query.dto';

/**
 * Query for a member's own attendance history. Pagination is inherited and
 * clamped (default 20, max 100); an optional `seasonId` scopes the sessions to
 * one season.
 */
export class AttendanceSelfHistoryQueryDto extends PracticeListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
