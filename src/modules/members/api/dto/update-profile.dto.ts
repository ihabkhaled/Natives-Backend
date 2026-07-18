import { ApiProperty } from '@core/openapi';
import { IsInt, Min, Type, ValidateNested } from '@core/validation';

import { PlayerProfileDto } from './player-profile.dto';

/**
 * Update a member profile. `expectedVersion` guards the write with optimistic
 * concurrency — a stale version is rejected with a conflict rather than silently
 * overwriting a concurrent edit.
 */
export class UpdateProfileDto {
  @ApiProperty({ type: PlayerProfileDto })
  @ValidateNested()
  @Type(() => PlayerProfileDto)
  declare readonly profile: PlayerProfileDto;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare readonly expectedVersion: number;
}
