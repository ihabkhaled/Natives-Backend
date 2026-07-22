import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { TryoutCandidateNotFoundError } from '../errors/tryout-candidate-not-found.error';
import { TryoutEventNotFoundError } from '../errors/tryout-event-not-found.error';
import { TryoutScopeNotFoundError } from '../errors/tryout-scope-not-found.error';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import { TryoutEventRepository } from '../infrastructure/tryout-event.repository';
import type { TryoutCandidate, TryoutEvent } from '../model/tryouts.types';

/**
 * Resolves a team-owned tryout event or candidate, translating a miss into a 404
 * that hides existence. Only the caller's own team is reachable — a cross-team
 * id resolves to not-found, never a leak of another club's registrants.
 */
@Injectable()
export class TryoutLookupService {
  constructor(
    private readonly events: TryoutEventRepository,
    private readonly candidates: TryoutCandidateRepository,
  ) {}

  async requireEvent(
    scope: TransactionScope,
    teamId: string,
    eventId: string,
  ): Promise<TryoutEvent> {
    const event = await this.events.findForWrite(scope, teamId, eventId);
    if (event === null) {
      throw new TryoutEventNotFoundError();
    }
    return event;
  }

  async requireCandidate(
    scope: TransactionScope,
    teamId: string,
    candidateId: string,
  ): Promise<TryoutCandidate> {
    const candidate = await this.candidates.findForWrite(
      scope,
      teamId,
      candidateId,
    );
    if (candidate === null) {
      throw new TryoutCandidateNotFoundError();
    }
    return candidate;
  }

  async requireScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<void> {
    if (!(await this.events.activeTeamExists(scope, teamId))) {
      throw new TryoutScopeNotFoundError();
    }
    if (!(await this.events.seasonExistsInTeam(scope, teamId, seasonId))) {
      throw new TryoutScopeNotFoundError();
    }
  }
}
