import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@shared/enums';

/**
 * Resolves whether the caller is a coaching-side analyst in this team, i.e.
 * whether they hold `match.analysis.read.team` within the team scope. That one
 * fact drives every visibility decision in the module, so it is resolved once,
 * server-side, from the effective-permission resolver — never inferred from a
 * client-supplied role, a header, or the request body.
 */
@Injectable()
export class AnalysisAuthorityService {
  constructor(
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissions: EffectivePermissionResolverPort,
  ) {}

  async canReadTeamAnalysis(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<boolean> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return granted.has(Permission.MatchAnalysisReadTeam);
  }

  /** Whether the caller may author analysis — the tier a restricted source needs. */
  async canManageAnalysis(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<boolean> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return granted.has(Permission.MatchAnalysisManage);
  }
}
