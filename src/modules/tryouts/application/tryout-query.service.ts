import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { redactCandidate } from '../domain/candidate-privacy.policy';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import { TryoutEventRepository } from '../infrastructure/tryout-event.repository';
import { CandidateAudience } from '../model/tryouts.enums';
import type {
  CandidateListFilter,
  CandidateViewer,
  PageRequest,
  TryoutCandidate,
  TryoutCandidatePage,
  TryoutEvent,
  TryoutEventPage,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Read side of tryout events and candidates. Every candidate leaving this
 * service passes the privacy policy first: contact references need
 * `tryout.contacts.read` and the readiness/health fields need
 * `tryout.readiness.read`, resolved server-side from effective permissions.
 * A caller without those tiers receives nulls, never partial strings.
 */
@Injectable()
export class TryoutQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissions: EffectivePermissionResolverPort,
    private readonly events: TryoutEventRepository,
    private readonly candidates: TryoutCandidateRepository,
    private readonly lookup: TryoutLookupService,
  ) {}

  listEvents(teamId: string, page: PageRequest): Promise<TryoutEventPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.eventPage(tx, teamId, page),
    );
  }

  getEvent(teamId: string, eventId: string): Promise<TryoutEvent> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireEvent(tx, teamId, eventId),
    );
  }

  async listCandidates(
    actor: AuthUserIdentity,
    teamId: string,
    filter: CandidateListFilter,
    page: PageRequest,
  ): Promise<TryoutCandidatePage> {
    const viewer = await this.viewerFor(actor, teamId);
    return this.unitOfWork.runInTransaction(tx =>
      this.candidatePage(tx, teamId, viewer, filter, page),
    );
  }

  async getCandidate(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
  ): Promise<TryoutCandidate> {
    const viewer = await this.viewerFor(actor, teamId);
    return this.unitOfWork.runInTransaction(async tx =>
      redactCandidate(
        await this.lookup.requireCandidate(tx, teamId, candidateId),
        viewer,
      ),
    );
  }

  async viewerFor(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<CandidateViewer> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return {
      audience: granted.has(Permission.TryoutManage)
        ? CandidateAudience.Staff
        : CandidateAudience.Public,
      canReadContacts: granted.has(Permission.TryoutContactsRead),
      canReadReadiness: granted.has(Permission.TryoutReadinessRead),
    };
  }

  private async eventPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<TryoutEventPage> {
    const items = await this.events.listForTeam(tx, teamId, page);
    const total = await this.events.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async candidatePage(
    tx: TransactionScope,
    teamId: string,
    viewer: CandidateViewer,
    filter: CandidateListFilter,
    page: PageRequest,
  ): Promise<TryoutCandidatePage> {
    const rows = await this.candidates.listForScope(tx, teamId, filter, page);
    const total = await this.candidates.countForScope(tx, teamId, filter);
    const items = rows.map(row => redactCandidate(row, viewer));
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
