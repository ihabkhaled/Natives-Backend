import {
  type AuthUserIdentity,
  bundlePermissionsForRoles,
  type PermissionScope,
} from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { resolveEffectivePermissions } from '../domain/effective-permissions.policy';
import { isWithinPrivilegeCeiling } from '../domain/privilege-ceiling.policy';
import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { unionPermissions } from '../lib/rbac.helpers';

/**
 * Enforces the anti-escalation rule for role management: an actor may only grant
 * or revoke a role whose every permission the actor already holds within the
 * target scope. Resolves the actor's permissions authoritatively (fresh DB read,
 * never the resolver cache) so a stale cache can never widen the ceiling.
 */
@Injectable()
export class PrivilegeCeilingService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly repository: RbacRepository,
  ) {}

  async assertCanManageRole(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    roleId: string,
    target: PermissionScope,
  ): Promise<void> {
    const targetPermissions = await this.repository.loadRolePermissions(
      scope,
      roleId,
    );
    const actorPermissions = await this.resolveActorPermissions(
      scope,
      actor,
      target,
    );
    if (!isWithinPrivilegeCeiling(actorPermissions, targetPermissions)) {
      throw new EscalationDeniedError();
    }
  }

  /**
   * The actor's authoritative permission set for `target` (baseline ∪ scoped
   * assignments, read fresh, never the resolver cache). Public so the roles
   * projection can render the same ceiling the write path enforces.
   */
  async resolveActorPermissions(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    target: PermissionScope,
  ): Promise<ReadonlySet<string>> {
    const baseline = bundlePermissionsForRoles(actor.roles);
    const grants = await this.repository.loadAssignmentGrants(
      scope,
      actor.userId,
    );
    const scoped = resolveEffectivePermissions(
      grants,
      target,
      this.clock.now(),
    );
    return unionPermissions(baseline, scoped);
  }
}
