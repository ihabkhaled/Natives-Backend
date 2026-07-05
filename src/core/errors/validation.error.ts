import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class ValidationError extends AppError {
  readonly status = HttpStatus.BAD_REQUEST;
}
