import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CALENDAR_TOKEN_BYTES } from '../model/calendar.constants';
import type {
  CalendarTokenCredential,
  CalendarTokenPort,
} from '../model/calendar.types';

/** Sole owner of native cryptographic calendar-feed credential operations. */
@Injectable()
export class CalendarTokenAdapter implements CalendarTokenPort {
  issue(): CalendarTokenCredential {
    const raw = randomBytes(CALENDAR_TOKEN_BYTES).toString('base64url');
    return { raw, digest: this.digest(raw) };
  }

  digest(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
