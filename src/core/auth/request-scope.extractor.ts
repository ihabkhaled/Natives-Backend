import { AUTH_SEASON_ID_KEY, AUTH_TEAM_ID_KEY } from './auth.constants';
import type { AuthRequest, RouteValues } from './auth.types';
import type { PermissionScope } from './effective-permission-resolver.port';

function readValue(
  source: RouteValues | undefined,
  key: string,
): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  // Map.get avoids unsafe dynamic object property access on request-supplied data.
  const value = new Map(Object.entries(source)).get(key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Prefer a path param, fall back to a query value. */
function resolveDimension(
  request: AuthRequest,
  key: string,
): string | undefined {
  return readValue(request.params, key) ?? readValue(request.query, key);
}

/**
 * Extract the team/season scope from the request's validated route params or
 * query. Never reads the request body: client-supplied scope in a body is not
 * trusted. A missing/blank value yields an absent (global) scope dimension.
 */
export function extractRequestScope(request: AuthRequest): PermissionScope {
  const teamId = resolveDimension(request, AUTH_TEAM_ID_KEY);
  const seasonId = resolveDimension(request, AUTH_SEASON_ID_KEY);
  return {
    ...(teamId === undefined ? {} : { teamId }),
    ...(seasonId === undefined ? {} : { seasonId }),
  };
}
