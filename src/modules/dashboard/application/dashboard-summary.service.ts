import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { Inject, Injectable } from '@nestjs/common';

import { classifyPersona } from '../domain/dashboard-persona.policy';
import { assembleSummary } from '../lib/dashboard-summary.assembler';
import type {
  DashboardScope,
  DashboardSummary,
} from '../model/dashboard.types';
import { DashboardScopeService } from './dashboard-scope.service';
import { DashboardSignalsService } from './dashboard-signals.service';

/**
 * Builds the dashboard summary: resolve the caller's own team scope, resolve
 * their effective permissions inside it, collect the signals from every owning
 * module, and project the widgets that permission set reveals. The result is a
 * read-only projection stamped with a single clock reading — never a stored,
 * editable total, and never a widget the caller may not see.
 */
@Injectable()
export class DashboardSummaryService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly resolver: EffectivePermissionResolverPort,
    private readonly scopes: DashboardScopeService,
    private readonly signals: DashboardSignalsService,
  ) {}

  async summarize(
    actor: AuthUserIdentity,
    requestedTeamId: string | null,
  ): Promise<DashboardSummary> {
    const scope = await this.scopes.resolve(actor.userId, requestedTeamId);
    const permissions = await this.resolvePermissions(actor, scope);
    const persona = classifyPersona(permissions);
    const generatedAt = this.clock.now();
    if (scope === null) {
      return { persona, generatedAt, widgets: [] };
    }
    const bundle = await this.signals.collect(scope);
    return assembleSummary({ persona, permissions, generatedAt }, bundle);
  }

  private resolvePermissions(
    actor: AuthUserIdentity,
    scope: DashboardScope | null,
  ): Promise<ReadonlySet<string>> {
    if (scope === null) {
      return this.resolver.resolve(actor, {});
    }
    return this.resolver.resolve(actor, {
      teamId: scope.teamId,
      ...(scope.seasonId === null ? {} : { seasonId: scope.seasonId }),
    });
  }
}
