import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

/**
 * Query for a participation-inputs projection. An optional `seasonId` scopes the
 * facts to one season; omitting it aggregates across all seasons in the team.
 */
export class ParticipationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;
}
