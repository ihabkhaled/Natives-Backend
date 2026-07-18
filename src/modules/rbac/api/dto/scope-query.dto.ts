import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID, UUID_VERSION } from '@core/validation';

export class ScopeQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(UUID_VERSION)
  declare readonly teamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(UUID_VERSION)
  declare readonly seasonId?: string;
}
