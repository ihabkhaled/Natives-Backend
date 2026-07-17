import type { AuthUserIdentity } from '@core/auth';
import { IntegrationError } from '@core/errors/integration.error';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY } from '../model/auth.constants';
import { JwtTokenAdapter } from './jwt-token.adapter';

describe('JwtTokenAdapter', () => {
  const jwtService = { signAsync: vi.fn(), verify: vi.fn() };
  let adapter: JwtTokenAdapter;

  beforeEach(() => {
    adapter = new JwtTokenAdapter(jwtService as unknown as JwtService);
  });

  it('signs an app-owned identity', async () => {
    const identity: AuthUserIdentity = {
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
    };
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(adapter.sign(identity)).resolves.toBe('signed-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(identity);
  });

  it('maps token signing failures to a typed integration error', async () => {
    jwtService.signAsync.mockRejectedValue(new Error('vendor failure'));

    await expect(
      adapter.sign({
        userId: 'user-1',
        email: 'user@example.com',
        roles: [Role.User],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<IntegrationError>>({
        messageKey: AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY,
      }),
    );
  });

  it('returns a validated identity from a verified token', () => {
    const identity: AuthUserIdentity = {
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
    };
    jwtService.verify.mockReturnValue(identity);

    expect(adapter.verify('valid-token')).toEqual(identity);
  });

  it('returns null when the verified payload is malformed', () => {
    jwtService.verify.mockReturnValue({ userId: 'user-1' });

    expect(adapter.verify('malformed-token')).toBeNull();
  });

  it('returns null when the JWT vendor rejects the token', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    expect(adapter.verify('invalid-token')).toBeNull();
  });
});
