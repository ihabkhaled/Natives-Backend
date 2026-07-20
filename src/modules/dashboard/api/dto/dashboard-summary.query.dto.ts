import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID } from '@core/validation';

/**
 * Optional team selector. Omitted, the summary uses the caller's first active
 * membership. Supplied, the caller must hold a membership in that team — the
 * permission guard also resolves its scope from this value.
 */
export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly teamId?: string;
}
