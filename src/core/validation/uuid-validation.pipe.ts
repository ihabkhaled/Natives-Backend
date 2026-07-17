import { Injectable, ParseUUIDPipe } from '@nestjs/common';

import { createUuidValidationError } from './uuid-validation-error.factory';
import { UUID_VERSION } from './validation.constants';

@Injectable()
export class UuidValidationPipe extends ParseUUIDPipe {
  constructor() {
    super({
      version: UUID_VERSION,
      exceptionFactory: createUuidValidationError,
    });
  }
}
