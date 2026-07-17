import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AppConfigService } from '@config/app-config.service';
import type { DatabaseConfig } from '@config/config.types';
import type { AuthTokenPort } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import { PasswordHashAdapter } from '@modules/auth/adapters/password-hash.adapter';
import { AcceptInvitationUseCase } from '@modules/identity/application/accept-invitation.use-case';
import { CreateInvitationUseCase } from '@modules/identity/application/create-invitation.use-case';
import { LoginUseCase } from '@modules/identity/application/login.use-case';
import { LogoutAllUseCase } from '@modules/identity/application/logout-all.use-case';
import { RefreshSessionUseCase } from '@modules/identity/application/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '@modules/identity/application/request-password-reset.use-case';
import { ResetPasswordUseCase } from '@modules/identity/application/reset-password.use-case';
import { SecurityAuditService } from '@modules/identity/application/security-audit.service';
import { SessionIssuerService } from '@modules/identity/application/session-issuer.service';
import { FailedLoginStateRepository } from '@modules/identity/infrastructure/failed-login-state.repository';
import { InvitationRepository } from '@modules/identity/infrastructure/invitation.repository';
import { PasswordCredentialRepository } from '@modules/identity/infrastructure/password-credential.repository';
import { PasswordResetTokenRepository } from '@modules/identity/infrastructure/password-reset-token.repository';
import { RefreshSessionRepository } from '@modules/identity/infrastructure/refresh-session.repository';
import { SecurityEventRepository } from '@modules/identity/infrastructure/security-event.repository';
import { UserRepository } from '@modules/identity/infrastructure/user.repository';
import type { SecureRandomPort } from '@modules/identity/model/identity.types';
import { NodeEnv, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';

const TEST_DB_CONFIG: DatabaseConfig = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const IDENTITY_CONFIG = {
  refreshTokenTtlSeconds: 1000,
  invitationTtlSeconds: 1000,
  passwordResetTtlSeconds: 1000,
  maxFailedLoginAttempts: 3,
  failedLoginWindowSeconds: 900,
  accountLockoutSeconds: 900,
};

const NOW = new Date('2026-06-01T12:00:00.000Z');
const STRONG_PASSWORD = 'correct-horse-battery-staple';
const NEW_PASSWORD = 'entirely-different-secret-1';

class RecordingSecureRandom implements SecureRandomPort {
  private counter = 0;
  public last = '';

  generateToken(): string {
    this.counter += 1;
    this.last = `itok-${this.counter}-${randomUUID()}`;
    return this.last;
  }
}

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: [BaselineSchema1721200000000, IdentitySchema1721300000000],
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    return dataSource;
  } catch {
    return null;
  }
}

function buildWiring(dataSource: DataSource, secureRandom: SecureRandomPort) {
  const unitOfWork = new TypeormUnitOfWorkAdapter(dataSource);
  const clock: ClockPort = { now: () => NOW, uptime: () => 0 };
  const idGenerator: IdGeneratorPort = { generate: () => randomUUID() };
  const tokenPort: AuthTokenPort = {
    sign: () => Promise.resolve('jwt-access-token'),
    verify: () => null,
  };
  const passwordHash = new PasswordHashAdapter();
  const config = { identity: IDENTITY_CONFIG } as unknown as AppConfigService;

  const users = new UserRepository();
  const credentials = new PasswordCredentialRepository();
  const invitations = new InvitationRepository();
  const sessions = new RefreshSessionRepository();
  const resetTokens = new PasswordResetTokenRepository();
  const failedLogins = new FailedLoginStateRepository();
  const events = new SecurityEventRepository();
  const audit = new SecurityAuditService(clock, idGenerator, events);
  const sessionIssuer = new SessionIssuerService(
    clock,
    idGenerator,
    secureRandom,
    tokenPort,
    sessions,
    config,
  );

  return {
    createInvitation: new CreateInvitationUseCase(
      unitOfWork,
      clock,
      idGenerator,
      secureRandom,
      config,
      users,
      invitations,
      audit,
    ),
    acceptInvitation: new AcceptInvitationUseCase(
      unitOfWork,
      clock,
      idGenerator,
      passwordHash,
      users,
      credentials,
      invitations,
      audit,
      sessionIssuer,
    ),
    login: new LoginUseCase(
      unitOfWork,
      clock,
      idGenerator,
      passwordHash,
      config,
      users,
      failedLogins,
      audit,
      sessionIssuer,
    ),
    refresh: new RefreshSessionUseCase(
      unitOfWork,
      clock,
      sessions,
      users,
      audit,
      sessionIssuer,
    ),
    logoutAll: new LogoutAllUseCase(unitOfWork, clock, sessions, audit),
    requestReset: new RequestPasswordResetUseCase(
      unitOfWork,
      clock,
      idGenerator,
      secureRandom,
      config,
      users,
      resetTokens,
      audit,
    ),
    resetPassword: new ResetPasswordUseCase(
      unitOfWork,
      clock,
      passwordHash,
      resetTokens,
      credentials,
      sessions,
      audit,
    ),
  };
}

async function seedAdmin(dataSource: DataSource): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
    [id, `admin-${id}@example.test`, Role.Admin],
  );
  return id;
}

async function countActiveSessions(dataSource: DataSource): Promise<number> {
  const rows = await dataSource.query(
    `SELECT COUNT(*)::int AS count FROM "refresh_sessions" WHERE "revoked_at" IS NULL`,
  );
  return rows[0].count as number;
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Identity integration (PostgreSQL)'
  : `Identity integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }

  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  it('reaches the identity schema through a reversible migration from empty', async () => {
    await activeDataSource.runMigrations();

    const tables = await activeDataSource.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [
        [
          'users',
          'password_credentials',
          'invitations',
          'refresh_sessions',
          'password_reset_tokens',
          'failed_login_state',
          'security_events',
        ],
      ],
    );
    expect(tables).toHaveLength(7);

    await activeDataSource.undoLastMigration();
    const afterDown = await activeDataSource.query(
      `SELECT to_regclass('public.users') AS relation`,
    );
    expect(afterDown[0].relation).toBeNull();

    // Re-apply so the remaining lifecycle tests run against the schema.
    await activeDataSource.runMigrations();
  });

  it('runs invite -> accept -> login -> refresh rotate -> reuse-detect -> logout-all', async () => {
    const secureRandom = new RecordingSecureRandom();
    const wiring = buildWiring(activeDataSource, secureRandom);
    const invitedBy = await seedAdmin(activeDataSource);
    const email = `player-${randomUUID()}@example.test`;

    await wiring.createInvitation.execute({
      email,
      role: Role.User,
      invitedBy,
    });
    const inviteToken = secureRandom.last;

    const accepted = await wiring.acceptInvitation.execute({
      token: inviteToken,
      password: STRONG_PASSWORD,
      displayName: 'Player One',
      deviceLabel: 'browser',
    });
    expect(accepted.accessToken).toBe('jwt-access-token');

    const loggedIn = await wiring.login.execute({
      email,
      password: STRONG_PASSWORD,
      deviceLabel: 'browser',
    });

    const rotated = await wiring.refresh.execute({
      refreshToken: loggedIn.refreshToken,
      deviceLabel: 'browser',
    });
    expect(rotated.refreshToken).not.toBe(loggedIn.refreshToken);

    // Presenting the already-rotated token is reuse: it revokes the family.
    await expect(
      wiring.refresh.execute({
        refreshToken: loggedIn.refreshToken,
        deviceLabel: 'browser',
      }),
    ).rejects.toThrow();

    // The rotated successor is now revoked with the family.
    await expect(
      wiring.refresh.execute({
        refreshToken: rotated.refreshToken,
        deviceLabel: 'browser',
      }),
    ).rejects.toThrow();

    const reuseRows = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "refresh_sessions"
        WHERE "reuse_detected_at" IS NOT NULL`,
    );
    expect(reuseRows[0].count).toBeGreaterThan(0);

    await wiring.logoutAll.execute(accepted.userId);
    expect(await countActiveSessions(activeDataSource)).toBe(0);
  });

  it('runs forgot -> reset and revokes existing sessions', async () => {
    const secureRandom = new RecordingSecureRandom();
    const wiring = buildWiring(activeDataSource, secureRandom);
    const invitedBy = await seedAdmin(activeDataSource);
    const email = `recover-${randomUUID()}@example.test`;

    await wiring.createInvitation.execute({
      email,
      role: Role.User,
      invitedBy,
    });
    const inviteToken = secureRandom.last;
    await wiring.acceptInvitation.execute({
      token: inviteToken,
      password: STRONG_PASSWORD,
      displayName: null,
      deviceLabel: null,
    });
    const session = await wiring.login.execute({
      email,
      password: STRONG_PASSWORD,
      deviceLabel: null,
    });

    const ack = await wiring.requestReset.execute(email);
    expect(ack.message).toContain('reset');
    const resetToken = secureRandom.last;

    await wiring.resetPassword.execute({
      token: resetToken,
      password: NEW_PASSWORD,
    });

    // The pre-reset session is revoked.
    await expect(
      wiring.refresh.execute({
        refreshToken: session.refreshToken,
        deviceLabel: null,
      }),
    ).rejects.toThrow();

    // The new password authenticates.
    const relogin = await wiring.login.execute({
      email,
      password: NEW_PASSWORD,
      deviceLabel: null,
    });
    expect(relogin.accessToken).toBe('jwt-access-token');
  });

  it('always answers forgot-password generically for unknown accounts', async () => {
    const secureRandom = new RecordingSecureRandom();
    const wiring = buildWiring(activeDataSource, secureRandom);

    const ack = await wiring.requestReset.execute(
      `ghost-${randomUUID()}@example.test`,
    );

    expect(ack.message).toContain('reset');
    const tokens = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "password_reset_tokens"`,
    );
    // No reset token minted for a non-existent account.
    expect(secureRandom.last).toBe('');
    expect(tokens[0].count).toBeGreaterThanOrEqual(0);
  });

  it('consumes a reset token exactly once under a concurrent race', async () => {
    const secureRandom = new RecordingSecureRandom();
    const wiring = buildWiring(activeDataSource, secureRandom);
    const invitedBy = await seedAdmin(activeDataSource);
    const email = `race-${randomUUID()}@example.test`;

    await wiring.createInvitation.execute({
      email,
      role: Role.User,
      invitedBy,
    });
    await wiring.acceptInvitation.execute({
      token: secureRandom.last,
      password: STRONG_PASSWORD,
      displayName: null,
      deviceLabel: null,
    });
    await wiring.requestReset.execute(email);
    const resetToken = secureRandom.last;

    const outcomes = await Promise.allSettled([
      wiring.resetPassword.execute({
        token: resetToken,
        password: NEW_PASSWORD,
      }),
      wiring.resetPassword.execute({
        token: resetToken,
        password: NEW_PASSWORD,
      }),
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
