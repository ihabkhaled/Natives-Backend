import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { classifyIdempotency } from '../domain/idempotency.policy';
import { IdempotencyConflictError } from '../errors/idempotency-conflict.error';
import { IdempotencyRepository } from '../infrastructure/idempotency.repository';
import { IdempotencyOutcome } from '../model/platform.enums';
import type {
  IdempotencyDecision,
  IdempotencyLookup,
  IdempotencyRecord,
  ScalarPayload,
} from '../model/platform.types';

/**
 * The reusable idempotency primitive. `begin` classifies an incoming request
 * against any stored record for the same key + principal: a new key reserves an
 * in-progress record, a completed replay returns the stored result, and a hash
 * mismatch or in-flight duplicate raises a 409. `complete` records the final
 * result. All calls share the caller's transaction.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: IdempotencyRepository,
  ) {}

  async begin(
    scope: TransactionScope,
    lookup: IdempotencyLookup,
  ): Promise<IdempotencyDecision> {
    const existing = await this.repository.findByKey(
      scope,
      lookup.key,
      lookup.principalUserId,
    );
    if (existing === null) {
      return this.beginNew(scope, lookup);
    }
    return this.resolveExisting(existing, lookup.requestHash);
  }

  complete(
    scope: TransactionScope,
    recordId: string,
    statusCode: number,
    result: ScalarPayload,
    now: Date,
  ): Promise<void> {
    return this.repository.complete(scope, recordId, statusCode, result, now);
  }

  private resolveExisting(
    record: IdempotencyRecord,
    requestHash: string,
  ): IdempotencyDecision {
    if (
      classifyIdempotency(record, requestHash) === IdempotencyOutcome.Conflict
    ) {
      throw new IdempotencyConflictError();
    }
    return {
      outcome: IdempotencyOutcome.Replay,
      recordId: record.id,
      statusCode: record.statusCode,
      result: record.result,
    };
  }

  private async beginNew(
    scope: TransactionScope,
    lookup: IdempotencyLookup,
  ): Promise<IdempotencyDecision> {
    const recordId = this.idGenerator.generate();
    await this.repository.insertInProgress(scope, { id: recordId, ...lookup });
    return {
      outcome: IdempotencyOutcome.New,
      recordId,
      statusCode: null,
      result: null,
    };
  }
}
