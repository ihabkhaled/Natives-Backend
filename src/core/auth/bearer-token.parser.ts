import { AUTH_BEARER_PATTERN } from './auth.constants';

export function extractBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }

  return AUTH_BEARER_PATTERN.exec(authorization)?.[1];
}
