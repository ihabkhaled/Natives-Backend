import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, IsUUID, MaxLength } from '@core/validation';

import { NOTES_MAX_LENGTH } from '../../model/matches.constants';

/**
 * Request body to create the authoritative match record for a fixture. The
 * ruleset is pinned at creation: omit it to adopt the team's default ACTIVE
 * version, or name one explicitly. It never changes afterwards, so the caps a
 * match was played under stay recoverable.
 */
export class CreateMatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly fixtureId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly rosterId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly rulesetId?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
