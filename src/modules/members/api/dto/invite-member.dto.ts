import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUUID, Type, ValidateNested } from '@core/validation';

import { PlayerProfileDto } from './player-profile.dto';

/**
 * Invite a person into a team. The account link (`userId`) and season are
 * optional so historical players and candidates who never log in can still be
 * recorded. Identity of the inviter is taken from the token, never this body.
 */
export class InviteMemberDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly seasonId?: string;

  @ApiProperty({ type: PlayerProfileDto })
  @ValidateNested()
  @Type(() => PlayerProfileDto)
  declare readonly profile: PlayerProfileDto;
}
