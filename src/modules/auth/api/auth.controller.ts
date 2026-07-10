import { Public } from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AuthService } from '../application/auth.service';
import {
  AUTH_API_TAG,
  AUTH_LOGIN_ROUTE,
  AUTH_ROUTE,
} from '../model/auth.constants';
import { LoginDto } from './login.dto';
import { LoginResponseDto } from './login-response.dto';

@ApiTags(AUTH_API_TAG)
@Controller(AUTH_ROUTE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(AUTH_LOGIN_ROUTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive a JWT' })
  @ApiOkResponse({ description: 'Access token', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() credentials: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(credentials);
  }
}
