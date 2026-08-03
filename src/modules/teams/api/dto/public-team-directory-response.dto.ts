import { ApiProperty } from '@core/openapi';

import { PublicCompetitionResponseDto } from './public-competition-response.dto';
import { PublicRosterPlayerResponseDto } from './public-roster-player-response.dto';
import { PublicStaffMemberResponseDto } from './public-staff-member-response.dto';
import { PublicTeamProfileResponseDto } from './public-team-profile-response.dto';

export class PublicTeamDirectoryResponseDto {
  @ApiProperty({ type: PublicTeamProfileResponseDto })
  declare readonly profile: PublicTeamProfileResponseDto;

  @ApiProperty({ type: [PublicStaffMemberResponseDto] })
  declare readonly staff: readonly PublicStaffMemberResponseDto[];

  @ApiProperty({ type: [PublicRosterPlayerResponseDto] })
  declare readonly players: readonly PublicRosterPlayerResponseDto[];

  @ApiProperty({ type: [PublicCompetitionResponseDto] })
  declare readonly competitions: readonly PublicCompetitionResponseDto[];
}
