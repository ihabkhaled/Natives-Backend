import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class UnauthorizedError extends AppError {
  readonly status = HttpStatus.UNAUTHORIZED;
}
