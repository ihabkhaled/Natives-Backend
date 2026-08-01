import {
  type AuthUserIdentity,
  CurrentUser,
  Public,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ApproveSignupUseCase } from '../application/approve-signup.use-case';
import { ListPendingSignupsUseCase } from '../application/list-pending-signups.use-case';
import { RejectSignupUseCase } from '../application/reject-signup.use-case';
import { RequestSignupUseCase } from '../application/request-signup.use-case';
import {
  AUTH_ROUTE,
  AUTH_SIGNUP_APPROVE_ROUTE,
  AUTH_SIGNUP_REJECT_ROUTE,
  AUTH_SIGNUP_ROUTE,
  AUTH_SIGNUPS_PENDING_ROUTE,
  SIGNUP_ID_PARAM,
  SIGNUPS_API_TAG,
} from '../model/identity.constants';
import { PendingSignupListResponseDto } from './dto/pending-signup-list-response.dto';
import { PendingSignupResponseDto } from './dto/pending-signup-response.dto';
import { SignupAcknowledgementResponseDto } from './dto/signup-acknowledgement-response.dto';
import { SignupRequestDto } from './dto/signup-request.dto';

@ApiTags(SIGNUPS_API_TAG)
@Controller(AUTH_ROUTE)
export class SignupController {
  constructor(
    private readonly requestSignup: RequestSignupUseCase,
    private readonly listPendingSignups: ListPendingSignupsUseCase,
    private readonly approveSignup: ApproveSignupUseCase,
    private readonly rejectSignup: RejectSignupUseCase,
  ) {}

  @Public()
  @Post(AUTH_SIGNUP_ROUTE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request an account (self-signup, needs approval)' })
  @ApiCreatedResponse({
    description: 'Signup received; the account is pending admin approval',
    type: SignupAcknowledgementResponseDto,
  })
  signup(
    @Body() dto: SignupRequestDto,
  ): Promise<SignupAcknowledgementResponseDto> {
    return this.requestSignup.execute({
      email: dto.email,
      displayName: dto.displayName,
      password: dto.password,
    });
  }

  @Get(AUTH_SIGNUPS_PENDING_ROUTE)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'List self-signups awaiting approval' })
  @ApiOkResponse({
    description: 'Pending signups, oldest first',
    type: PendingSignupListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listPending(): Promise<PendingSignupListResponseDto> {
    return this.listPendingSignups.execute();
  }

  @Post(AUTH_SIGNUP_APPROVE_ROUTE)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a pending signup and activate the account',
  })
  @ApiOkResponse({
    description: 'Signup approved; account activated',
    type: PendingSignupResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  approve(
    @Param(SIGNUP_ID_PARAM, UuidValidationPipe) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<PendingSignupResponseDto> {
    return this.approveSignup.execute({
      signupId: id,
      reviewerId: user.userId,
    });
  }

  @Post(AUTH_SIGNUP_REJECT_ROUTE)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending signup; the account stays inert' })
  @ApiOkResponse({
    description: 'Signup rejected',
    type: PendingSignupResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reject(
    @Param(SIGNUP_ID_PARAM, UuidValidationPipe) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<PendingSignupResponseDto> {
    return this.rejectSignup.execute({
      signupId: id,
      reviewerId: user.userId,
    });
  }
}
