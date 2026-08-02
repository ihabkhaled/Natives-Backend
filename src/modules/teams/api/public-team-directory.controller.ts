import { Public } from '@core/auth';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@core/openapi';
import { Controller, Get, Param } from '@nestjs/common';

import { PublicTeamDirectoryService } from '../application/public-team-directory.service';
import {
  PUBLIC_TEAM_API_TAG,
  PUBLIC_TEAM_DIRECTORY_ROUTE,
  PUBLIC_TEAMS_ROUTE,
  TEAM_SLUG_PARAM,
} from '../model/teams.constants';
import { PublicTeamDirectoryResponseDto } from './dto/public-team-directory-response.dto';

/**
 * Public team directory: unauthenticated, bounded, publishable-fields-only
 * read of a team's profile, staff "who's who", and active roster. Backs the
 * landing site — no email, PII, or private field ever appears here.
 */
@ApiTags(PUBLIC_TEAM_API_TAG)
@Controller(PUBLIC_TEAMS_ROUTE)
export class PublicTeamDirectoryController {
  constructor(private readonly directory: PublicTeamDirectoryService) {}

  @Public()
  @Get(PUBLIC_TEAM_DIRECTORY_ROUTE)
  @ApiOperation({ summary: 'Get a team’s public profile, staff, and roster' })
  @ApiOkResponse({
    description: 'Public team directory',
    type: PublicTeamDirectoryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Team not found' })
  get(
    @Param(TEAM_SLUG_PARAM) slug: string,
  ): Promise<PublicTeamDirectoryResponseDto> {
    return this.directory.getDirectory(slug);
  }
}
