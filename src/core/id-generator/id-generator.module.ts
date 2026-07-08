import { Module } from '@nestjs/common';

import { ID_GENERATOR_PORT } from './id-generator.port';
import { UuidIdGeneratorService } from './uuid-id-generator.service';

@Module({
  providers: [
    {
      provide: ID_GENERATOR_PORT,
      useClass: UuidIdGeneratorService,
    },
  ],
  exports: [ID_GENERATOR_PORT],
})
export class IdGeneratorModule {}
