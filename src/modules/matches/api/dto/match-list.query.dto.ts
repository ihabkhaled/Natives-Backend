import { ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Type,
} from '@core/validation';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/matches.constants';
import { MatchStatus } from '../../model/matches.enums';

/** Bounded, allow-listed filter + pagination for the match list. */
export class MatchListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly fixtureId?: string;

  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  readonly status?: MatchStatus;

  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
