import { compare } from 'bcrypt';

/**
 * Compares a plaintext password against its bcrypt hash. Lives in lib/ so the
 * auth service stays orchestration-only (rules/03, rules/23) and password
 * verification has one owner (rules/22).
 */
export function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plainPassword, passwordHash);
}
