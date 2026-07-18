import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { canRecordInto } from '../domain/attendance.state-machine';
import { AttendanceLockedError } from '../errors/attendance-locked.error';
import { AttendanceSheetNotFoundError } from '../errors/attendance-sheet-not-found.error';
import { AttendanceSheetRepository } from '../infrastructure/attendance-sheet.repository';
import { buildNewSheet } from '../lib/attendance.builders';
import type { AttendanceSheet } from '../model/attendance.types';
import type { PracticeSession } from '../model/practices.types';

/**
 * Resolves the per-session attendance sheet for a write. `ensureOpenSheet` creates
 * the OPEN sheet on first write (idempotently, tolerating a concurrent create) and
 * refuses a locked sheet so recording never edits finalized attendance;
 * `requireSheet` loads an existing sheet for finalize/correct, or a clean not-found.
 * It never opens its own transaction — it enlists in the caller's.
 */
@Injectable()
export class AttendanceSheetService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly sheets: AttendanceSheetRepository,
  ) {}

  async ensureOpenSheet(
    scope: TransactionScope,
    session: PracticeSession,
    actorUserId: string | null,
    now: Date,
  ): Promise<AttendanceSheet> {
    const sheet = await this.resolveSheet(scope, session, actorUserId, now);
    if (!canRecordInto(sheet.state)) {
      throw new AttendanceLockedError();
    }
    return sheet;
  }

  async requireSheet(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<AttendanceSheet> {
    const sheet = await this.sheets.findBySession(scope, sessionId);
    if (sheet === null) {
      throw new AttendanceSheetNotFoundError();
    }
    return sheet;
  }

  private async resolveSheet(
    scope: TransactionScope,
    session: PracticeSession,
    actorUserId: string | null,
    now: Date,
  ): Promise<AttendanceSheet> {
    const created = await this.sheets.insertSheet(
      scope,
      buildNewSheet(this.idGenerator.generate(), session, actorUserId, now),
    );
    const sheet =
      created ?? (await this.sheets.findBySession(scope, session.id));
    if (sheet === null) {
      throw new AttendanceSheetNotFoundError();
    }
    return sheet;
  }
}
