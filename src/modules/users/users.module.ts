import { Module } from '@nestjs/common';

import { UsersService } from './application/users.service';
import { UsersRepository } from './infrastructure/users.repository';

@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
