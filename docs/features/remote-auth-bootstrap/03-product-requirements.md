# 03 — Product Requirements

## Requirements

1. `POST /auth/login` returns:
   - `tokens.accessToken`
   - `tokens.refreshToken`
   - `user.id`, `email`, `displayName`, `permissions`, `accountState`, `onboardingComplete`, and `memberships`
2. Permission keys come from the effective-permission resolver after credentials succeed.
3. Internal active/invited/other user statuses map to client states active/pending/suspended.
4. Normal application startup never checks for or creates a database.
5. An explicit setup command can ensure the database exists, run migrations, and seed an admin.
6. Admin seeding is idempotent and requires a non-empty runtime password; no usable password is committed.
7. Setup failures exit non-zero and never log credentials.

## Acceptance criteria

- The nested login response is covered by mapper, use-case, OpenAPI DTO, and HTTP/integration tests.
- Flat token fields are absent from login responses; refresh remains unchanged.
- `.env.example` is clearly synthetic/local and leaves `SEED_ADMIN_PASSWORD` unset.
- Database ensure is invoked only by the explicit setup path.
- Seed reruns preserve one active user/role assignment and deliberately refresh the password hash.

## Non-goals

- Team/season membership aggregation.
- Frontend implementation.
- Automatic production bootstrap or schema synchronization.
- Changing refresh/invitation session response contracts.

Localization/analytics: not applicable; no user-facing message key or analytics event changes. Permissions remain server-derived.
