import {
  type AuthUserIdentity,
  bundlePermissionsForRoles,
  type EffectivePermissionResolverPort,
  type PermissionScope,
} from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { AppLogger } from '@core/logger';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { resolveEffectivePermissions } from '../domain/effective-permissions.policy';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { unionPermissions } from '../lib/rbac.helpers';
import { RBAC_SCOPED_RESOLUTION_FAILED_LOG } from '../model/rbac.constants';
import type { ResolverCacheEntry } from '../model/rbac.types';

const LOG_PREFIX = 'RbacPermissionResolver';

/**
 * Resolves a principal's effective permissions as the union of the account-role
 * baseline (no database) and the deterministic union of database-backed, scoped,
 * in-effect role assignments. The raw per-user grants are cached and validated
 * against the RBAC policy version on every call: an assignment/role change bumps
 * the version (in the assign/revoke use cases), which invalidates the cache on
 * the next read. Scope + effective-window filtering runs fresh each call so time
 * windows are always honored. If the policy store is unreachable, resolution
 * degrades safely to the baseline (scoped grants are purely additive).
 */
@Injectable()
export class RbacPermissionResolverService implements EffectivePermissionResolverPort {
  private readonly cache = new Map<string, ResolverCacheEntry>();
  private readonly empty: ReadonlySet<string> = new Set<string>();

  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RbacRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(LOG_PREFIX);
  }

  async resolve(
    principal: AuthUserIdentity,
    scope: PermissionScope,
  ): Promise<ReadonlySet<string>> {
    try {
      return await this.unitOfWork.runInTransaction(txScope =>
        this.resolveInTransaction(txScope, principal, scope),
      );
    } catch {
      this.logger.debug(RBAC_SCOPED_RESOLUTION_FAILED_LOG, {
        userId: principal.userId,
      });
      return bundlePermissionsForRoles(principal.roles);
    }
  }

  private async resolveInTransaction(
    scope: TransactionScope,
    principal: AuthUserIdentity,
    requestScope: PermissionScope,
  ): Promise<ReadonlySet<string>> {
    const active = await this.repository.isUserActive(scope, principal.userId);
    if (!active) {
      return this.empty;
    }
    const baseline = bundlePermissionsForRoles(principal.roles);
    const scoped = await this.resolveScoped(
      scope,
      principal.userId,
      requestScope,
    );
    return unionPermissions(baseline, scoped);
  }

  private async resolveScoped(
    scope: TransactionScope,
    userId: string,
    requestScope: PermissionScope,
  ): Promise<ReadonlySet<string>> {
    const version = await this.repository.currentPolicyVersion(scope);
    const grants =
      this.readCache(userId, version) ??
      (await this.loadAndCache(scope, userId, version));
    return resolveEffectivePermissions(grants, requestScope, this.clock.now());
  }

  private readCache(
    userId: string,
    version: number,
  ): ResolverCacheEntry['grants'] | undefined {
    const entry = this.cache.get(userId);
    if (entry === undefined) {
      return undefined;
    }
    return entry.version === version ? entry.grants : undefined;
  }

  private async loadAndCache(
    scope: TransactionScope,
    userId: string,
    version: number,
  ): Promise<ResolverCacheEntry['grants']> {
    const grants = await this.repository.loadAssignmentGrants(scope, userId);
    this.cache.set(userId, { version, grants });
    return grants;
  }
}
