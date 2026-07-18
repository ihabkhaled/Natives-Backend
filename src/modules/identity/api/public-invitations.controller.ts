import { Public } from '@core/auth';
import { ApiOkResponse, ApiOperation, ApiTags } from '@core/openapi';
import { Controller, Get, Param } from '@nestjs/common';

import { GetInvitationDetailsUseCase } from '../application/get-invitation-details.use-case';
import {
  AUTH_API_TAG,
  AUTH_PUBLIC_INVITATION_ROUTE,
  AUTH_ROUTE,
} from '../model/identity.constants';
import { InvitationTokenParamsDto } from './dto/invitation-token-params.dto';
import { PublicInvitationResponseDto } from './dto/public-invitation-response.dto';

@ApiTags(AUTH_API_TAG)
@Controller(AUTH_ROUTE)
export class PublicInvitationsController {
  constructor(
    private readonly getInvitationDetails: GetInvitationDetailsUseCase,
  ) {}

  @Public()
  @Get(AUTH_PUBLIC_INVITATION_ROUTE)
  @ApiOperation({ summary: 'Inspect a pending invitation by opaque token' })
  @ApiOkResponse({
    description: 'Minimal pending invitation details',
    type: PublicInvitationResponseDto,
  })
  get(
    @Param() params: InvitationTokenParamsDto,
  ): Promise<PublicInvitationResponseDto> {
    return this.getInvitationDetails.execute(params.token);
  }
}
