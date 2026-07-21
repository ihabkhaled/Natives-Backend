import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min } from '@core/validation';

/**
 * Body of a lifecycle transition. `expectedVersion` is optional: supply it to
 * make the move optimistic (409 when the aggregate changed underneath), omit it
 * to apply the transition to whatever version is current.
 */
export class TeamTransitionDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  declare readonly expectedVersion?: number;
}
