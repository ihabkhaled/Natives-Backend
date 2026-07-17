import { AppConfigService } from '@config/app-config.service';
import { AUTH_TOKEN_PORT, JwtAuthGuard, PermissionsGuard } from '@core/auth';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { JwtTokenAdapter } from './adapters/jwt-token.adapter';
import { PasswordHashAdapter } from './adapters/password-hash.adapter';
import { PASSWORD_HASH_PORT } from './model/auth.constants';

/**
 * Owns the authentication security primitives: the JWT signing/verification
 * vendor (@nestjs/jwt) and the bcrypt password-hash vendor, each behind an
 * app-owned port. Also provides the global guards. Feature modules that need to
 * sign access tokens or hash/verify passwords import this module and inject the
 * ports — they never see @nestjs/jwt or bcrypt.
 */
@Module({
  imports: [
    RbacModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        secret: appConfigService.security.jwtSecret,
        signOptions: {
          expiresIn: appConfigService.security.jwtExpiresInSeconds,
        },
      }),
    }),
  ],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    { provide: AUTH_TOKEN_PORT, useClass: JwtTokenAdapter },
    { provide: PASSWORD_HASH_PORT, useClass: PasswordHashAdapter },
  ],
  exports: [
    JwtAuthGuard,
    PermissionsGuard,
    AUTH_TOKEN_PORT,
    PASSWORD_HASH_PORT,
  ],
})
export class AuthModule {}
