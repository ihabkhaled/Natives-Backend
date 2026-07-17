import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { IdGeneratorPort } from './id-generator.port';

@Injectable()
export class UuidIdGeneratorService implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
