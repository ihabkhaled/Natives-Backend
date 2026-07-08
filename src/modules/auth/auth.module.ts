import { AppConfigService } from '@config/app-config.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users';
import { AuthController } from './api/auth.controller';
import { AuthService } from './application/auth.service';

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
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
