import { Injectable } from '@nestjs/common';

import { ClockPort } from './clock.port';

@Injectable()
export class SystemClockService implements ClockPort {
  now(): Date {
    return new Date();
  }

  uptime(): number {
    return process.uptime();
  }
}
