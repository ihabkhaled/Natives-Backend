import { RBAC_TEAM_ROLE_SCOPE } from '../model/rbac.constants';
import type { RoleDefinitionRow } from '../model/rbac.rows';
import type { AssignableRoleEntry } from '../model/rbac.types';
import { toRoleSlug } from './role-slug.mapper';

/**
 * Join the ceiling-projected assignable slugs with the catalog's display
 * metadata, keeping only roles that are team-scoped AND assignable. The slug
 * order of the ceiling projection (sorted) is preserved, so the invite form
 * renders deterministically. Pure: no I/O, no clock.
 */
export function toAssignableRoleEntries(
  assignableSlugs: readonly string[],
  definitions: readonly RoleDefinitionRow[],
): readonly AssignableRoleEntry[] {
  const bySlug = new Map<string, RoleDefinitionRow>(
    definitions
      .filter(row => row.scope === RBAC_TEAM_ROLE_SCOPE && row.is_assignable)
      .map(row => [toRoleSlug(row.key), row]),
  );
  return assignableSlugs.flatMap(slug => {
    const definition = bySlug.get(slug);
    if (definition === undefined) {
      return [];
    }
    return [
      {
        slug,
        displayName: definition.display_name,
        description: definition.description,
      },
    ];
  });
}
