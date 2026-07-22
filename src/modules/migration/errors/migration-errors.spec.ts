import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AliasCollisionError } from './alias-collision.error';
import { AliasResolutionNotFoundError } from './alias-resolution-not-found.error';
import { ComparisonNotFoundError } from './comparison-not-found.error';
import { ImportJobNotFoundError } from './import-job-not-found.error';
import { ImportNotCommittableError } from './import-not-committable.error';
import { ImportNotReversibleError } from './import-not-reversible.error';
import { MigrationScopeNotFoundError } from './migration-scope-not-found.error';
import { MigrationValidationError } from './migration-validation.error';
import { MigrationVersionConflictError } from './migration-version-conflict.error';

describe('migration errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new ImportJobNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.migration.importJobNotFound',
      },
      {
        error: new AliasResolutionNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.migration.aliasResolutionNotFound',
      },
      {
        error: new ComparisonNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.migration.comparisonNotFound',
      },
      {
        error: new MigrationScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.migration.scopeNotFound',
      },
      {
        error: new MigrationValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.migration.validation',
      },
      {
        error: new ImportNotCommittableError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.migration.importNotCommittable',
      },
      {
        error: new ImportNotReversibleError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.migration.importNotReversible',
      },
      {
        error: new AliasCollisionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.migration.aliasCollision',
      },
      {
        error: new MigrationVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.migration.versionConflict',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('never leaks SQL, vendor text, or personal data in a message', () => {
    for (const message of [
      new ImportJobNotFoundError().message,
      new AliasCollisionError().message,
      new ImportNotCommittableError().message,
    ]) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
