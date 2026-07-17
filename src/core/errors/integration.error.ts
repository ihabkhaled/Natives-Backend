import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class IntegrationError extends AppError {
  readonly status = HttpStatus.BAD_GATEWAY;
}
