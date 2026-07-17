import type { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

// Routes all Nest framework logs through the logging vendor. Kept here so the
// vendor import stays inside the logger module; bootstrap calls this helper.
export function bindAppLogger(app: INestApplication): void {
  app.useLogger(app.get(Logger));
}
