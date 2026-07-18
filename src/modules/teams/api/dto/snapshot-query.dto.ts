import { ApiPropertyOptional } from '@core/openapi';
import { IsDateString, IsOptional } from '@core/validation';

export class SnapshotQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Resolve settings effective as of this instant (defaults to now)',
  })
  @IsOptional()
  @IsDateString()
  declare readonly asOf?: string;
}
