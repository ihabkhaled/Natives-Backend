import { AppConfigService } from '@config/app-config.service';
import { AUTH_TOKEN_PORT, JwtAuthGuard, PermissionsGuard } from '@core/auth';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users';
import { JwtTokenAdapter } from './adapters/jwt-token.adapter';
import { PasswordHashAdapter } from './adapters/password-hash.adapter';
import { AuthController } from './api/auth.controller';
import { AuthService } from './application/auth.service';
import { PASSWORD_HASH_PORT } from './model/auth.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        secret: appConfigService.security.jwtSecret,
        signOptions: {
          expiresIn: appConfigService.security.jwtExpiresInSeconds,
        },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
    { provide: AUTH_TOKEN_PORT, useClass: JwtTokenAdapter },
    { provide: PASSWORD_HASH_PORT, useClass: PasswordHashAdapter },
  ],
  exports: [AuthService],
})
export class AuthModule {}
