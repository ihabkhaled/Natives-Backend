import { BadgeStatus } from '../model/points.enums';
import type { BadgeDefinition } from '../model/points.types';

/**
 * Pure badge-threshold policy. A definition is crossed when the member's projected
 * total is STRICTLY greater than its threshold (>100 / >200 / >450 exact) and it
 * has not already been earned. Only `active` definitions are ever considered, so
 * the seeded `needs_approval` candidates and the disabled broken `#REF!` tier are
 * never awarded. No side effects, no time — every branch is unit-tested.
 */
export function badgesToAward(
  definitions: readonly BadgeDefinition[],
  total: number,
  earnedDefinitionIds: ReadonlySet<string>,
): readonly BadgeDefinition[] {
  return definitions.filter(definition =>
    isCrossed(definition, total, earnedDefinitionIds),
  );
}

/** True when a member's total newly crosses an active definition's threshold. */
export function isCrossed(
  definition: BadgeDefinition,
  total: number,
  earnedDefinitionIds: ReadonlySet<string>,
): boolean {
  if (definition.status !== BadgeStatus.Active) {
    return false;
  }
  if (earnedDefinitionIds.has(definition.id)) {
    return false;
  }
  return total > definition.threshold;
}
