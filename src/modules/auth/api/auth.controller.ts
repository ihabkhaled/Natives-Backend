import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from '../application/auth.service';
import { Public } from '../public.decorator';
import { LoginDto } from './login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive a JWT' })
  @ApiOkResponse({ description: 'Access token' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() credentials: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(credentials);
  }
}
