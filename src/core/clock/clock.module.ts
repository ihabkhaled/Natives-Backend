import { Module } from '@nestjs/common';

import { CLOCK_PORT } from './clock.port';
import { SystemClockService } from './system-clock.service';

@Module({
  providers: [
    {
      provide: CLOCK_PORT,
      useClass: SystemClockService,
    },
  ],
  exports: [CLOCK_PORT],
})
export class ClockModule {}
