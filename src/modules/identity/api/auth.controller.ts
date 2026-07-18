import {
  type AuthUserIdentity,
  CurrentUser,
  Public,
  RequirePermissions,
} from '@core/auth';
import {
  ApiNotFoundResponse,
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
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { GetCurrentPrincipalUseCase } from '../application/get-current-principal.use-case';
import { ListSessionsUseCase } from '../application/list-sessions.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { LogoutAllUseCase } from '../application/logout-all.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../application/reset-password.use-case';
import { RevokeOtherSessionsUseCase } from '../application/revoke-other-sessions.use-case';
import { RevokeSessionUseCase } from '../application/revoke-session.use-case';
import {
  AUTH_API_TAG,
  AUTH_FORGOT_PASSWORD_ROUTE,
  AUTH_LOGIN_ROUTE,
  AUTH_LOGOUT_ALL_ROUTE,
  AUTH_LOGOUT_ROUTE,
  AUTH_ME_ROUTE,
  AUTH_REFRESH_ROUTE,
  AUTH_RESET_PASSWORD_ROUTE,
  AUTH_ROUTE,
  AUTH_SESSION_ID_PARAM,
  AUTH_SESSION_REVOKE_ROUTE,
  AUTH_SESSIONS_REVOKE_OTHERS_ROUTE,
  AUTH_SESSIONS_ROUTE,
} from '../model/identity.constants';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto, LoginResponseDto } from './dto/login-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RevokeOtherSessionsResponseDto } from './dto/revoke-other-sessions-response.dto';
import { SessionListQueryDto } from './dto/session-list-query.dto';
import { SessionListResponseDto } from './dto/session-list-response.dto';

@ApiTags(AUTH_API_TAG)
@Controller(AUTH_ROUTE)
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly getCurrentPrincipal: GetCurrentPrincipalUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly revokeOtherSessionsUseCase: RevokeOtherSessionsUseCase,
  ) {}

  @Public()
  @Post(AUTH_LOGIN_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive access + refresh tokens' })
  @ApiOkResponse({ description: 'Session issued', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      deviceLabel: dto.deviceLabel ?? null,
    });
  }

  @Public()
  @Post(AUTH_REFRESH_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh session' })
  @ApiOkResponse({
    description: 'Session rotated',
    type: AuthSessionResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshDto): Promise<AuthSessionResponseDto> {
    return this.refreshUseCase.execute({
      refreshToken: dto.refreshToken,
      deviceLabel: dto.deviceLabel ?? null,
    });
  }

  @Post(AUTH_LOGOUT_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiOkResponse({ description: 'Session revoked', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  logout(
    @CurrentUser() user: AuthUserIdentity,
    @Body() dto: LogoutDto,
  ): Promise<MessageResponseDto> {
    return this.logoutUseCase.execute(user.userId, dto.refreshToken);
  }

  @Post(AUTH_LOGOUT_ALL_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions for the current user' })
  @ApiOkResponse({ description: 'Sessions revoked', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  logoutAll(
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<MessageResponseDto> {
    return this.logoutAllUseCase.execute(user.userId);
  }

  @Get(AUTH_ME_ROUTE)
  @ApiOperation({ summary: 'Get the current principal' })
  @ApiOkResponse({
    description: 'Current principal',
    type: AuthUserDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  me(@CurrentUser() user: AuthUserIdentity): Promise<AuthUserDto> {
    return this.getCurrentPrincipal.execute(user.userId);
  }

  @Get(AUTH_SESSIONS_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @ApiOperation({ summary: 'List active refresh sessions for the caller' })
  @ApiOkResponse({
    description: 'Bounded active session page',
    type: SessionListResponseDto,
  })
  listSessions(
    @CurrentUser() user: AuthUserIdentity,
    @Query() query: SessionListQueryDto,
  ): Promise<SessionListResponseDto> {
    return this.listSessionsUseCase.execute(user.userId, user.sessionId, query);
  }

  @Post(AUTH_SESSIONS_REVOKE_OTHERS_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke all refresh sessions except the current one',
  })
  @ApiOkResponse({
    description: 'Other sessions revoked',
    type: RevokeOtherSessionsResponseDto,
  })
  revokeOtherSessions(
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<RevokeOtherSessionsResponseDto> {
    return this.revokeOtherSessionsUseCase.execute(user.userId, user.sessionId);
  }

  @Post(AUTH_SESSION_REVOKE_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke one owned refresh session' })
  @ApiOkResponse({
    description: 'Session revoked',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  revokeSession(
    @CurrentUser() user: AuthUserIdentity,
    @Param(AUTH_SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<MessageResponseDto> {
    return this.revokeSessionUseCase.execute(user.userId, sessionId);
  }

  @Public()
  @Post(AUTH_FORGOT_PASSWORD_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset (generic response)' })
  @ApiOkResponse({ description: 'Acknowledged', type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.requestPasswordReset.execute(dto.email);
  }

  @Public()
  @Post(AUTH_RESET_PASSWORD_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a password with a one-time token' })
  @ApiOkResponse({ description: 'Password reset', type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.resetPasswordUseCase.execute({
      token: dto.token,
      password: dto.password,
    });
  }
}
