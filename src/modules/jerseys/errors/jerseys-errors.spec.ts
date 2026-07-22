import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InsufficientStockError } from './insufficient-stock.error';
import { JerseyScopeNotFoundError } from './jersey-scope-not-found.error';
import { JerseyValidationError } from './jersey-validation.error';
import { JerseyVersionConflictError } from './jersey-version-conflict.error';
import { NumberCollisionError } from './number-collision.error';
import { OrderInvalidTransitionError } from './order-invalid-transition.error';
import { OrderLockedError } from './order-locked.error';
import { OrderNotFoundError } from './order-not-found.error';
import { ProductNotFoundError } from './product-not-found.error';
import { ReservationNotFoundError } from './reservation-not-found.error';

describe('jerseys errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new ProductNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.jerseys.productNotFound',
      },
      {
        error: new ReservationNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.jerseys.reservationNotFound',
      },
      {
        error: new OrderNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.jerseys.orderNotFound',
      },
      {
        error: new JerseyScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.jerseys.scopeNotFound',
      },
      {
        error: new JerseyValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.jerseys.validation',
      },
      {
        error: new NumberCollisionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.jerseys.numberCollision',
      },
      {
        error: new OrderInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.jerseys.orderInvalidTransition',
      },
      {
        error: new OrderLockedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.jerseys.orderLocked',
      },
      {
        error: new JerseyVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.jerseys.versionConflict',
      },
      {
        error: new InsufficientStockError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.jerseys.insufficientStock',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('never leaks SQL, vendor text, or personal data in a message', () => {
    const messages = [
      new ProductNotFoundError().message,
      new NumberCollisionError().message,
      new InsufficientStockError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
