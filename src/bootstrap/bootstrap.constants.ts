export const LISTEN_HOST = '0.0.0.0';
export const TRUST_PROXY = false;

// Explicit CORS method allowlist. @fastify/cors reflects this exact list on the
// preflight Access-Control-Allow-Methods header; every mutating verb this API
// exposes (PUT/PATCH/DELETE) must be present or the browser blocks the actual
// request as a CORS failure even though the server would have accepted it.
export const CORS_ALLOWED_METHODS: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

// Response headers a browser is allowed to READ across an origin. Without an
// explicit Access-Control-Expose-Headers a cross-origin client only ever sees
// the seven CORS-safelisted headers, so anything the SPA actually reads must be
// listed here or it silently reads `null`:
//   - x-request-id      the correlation id every response carries, which the
//                       client attaches to error reports and support tickets;
//   - content-disposition  the filename of the public ICS calendar feed and of
//                       every future report/export download;
//   - retry-after       emitted by the throttler on 429 so the client can back
//                       off for the right interval instead of guessing.
export const CORS_EXPOSED_HEADERS: readonly string[] = [
  'x-request-id',
  'content-disposition',
  'retry-after',
];

// Request headers the browser may send. @fastify/cors would otherwise reflect
// whatever the preflight asked for; naming them keeps the contract explicit and
// still covers everything this API consumes (bearer auth, JSON bodies, the
// client-supplied correlation id, and the idempotency key on retryable writes).
export const CORS_ALLOWED_HEADERS: readonly string[] = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'idempotency-key',
  'x-request-id',
];

// Preflight cache lifetime (seconds). Browsers cap this themselves; 10 minutes
// removes an OPTIONS round-trip per request burst without pinning stale policy.
export const CORS_MAX_AGE_SECONDS = 600;

// Correlation header echoed on every response. Same name the client may send in
// (see CORS_ALLOWED_HEADERS), so a request id chosen by the SPA survives the
// round trip and stitches browser, API and job logs together.
export const REQUEST_ID_HEADER = 'x-request-id';

// 1 MiB request body cap — reject oversized payloads at the transport edge.
export const BODY_LIMIT_BYTES = 1_048_576;

export const DEFAULT_API_VERSION = '1';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_TITLE = 'Service API';
export const SWAGGER_DESCRIPTION = 'HTTP API for this NestJS service';
// 1.1.0: additive P0-recovery contract changes — team-scoped invitations
// (POST /teams/{teamId}/invitations), invitation payloads carry teamId, and the
// team leaderboard read is gated by leaderboard.read.
// 1.2.0: additive P1 onboarding/ops surfaces — invitations carry an optional
// teamRole request field and teamRole/teamId/teamName response fields; the
// assignable-roles catalog (GET /rbac/teams/{teamId}/assignable-roles); platform
// super-admin management (GET/POST/DELETE /rbac/platform/super-admins); the
// dead-letter listing (GET /admin/outbox/dead-letters); and scheduled-job
// health (GET /admin/jobs/health).
// 1.3.0: P2 typed team settings — POST /teams/{teamId}/settings/versions body
// becomes a discriminated oneOf of 8 per-key request DTOs (discriminator
// settingKey), note is required (min 5) and effectiveFrom must be strict UTC
// (breaking for raw-JSON writers); optional expectedHeadVersionId concurrency
// guard; version/effective-setting responses carry valueState (+ issues on the
// snapshot) with typed per-key value schemas; new
// DELETE /teams/{teamId}/settings/versions/{versionId} cancels a
// future-effective version.
// 1.4.0: additive P3 attendance self-service hardening — new
// GET /teams/{teamId}/attendance/me/history (paginated own history, newest
// first, null-status rows for unrecorded sessions); the own-attendance read
// gains a nullable selfCheckIn eligibility block ({state, opensAt, closesAt});
// self check-in enforces the explicit window (opens startsAt−60m, closes at
// session end, published/rescheduled only ⇒ 409
// errors.practices.checkInWindowClosed) and is idempotent (repeat POSTs return
// the existing record unchanged); roster entries carry displayName + rsvpStatus
// (both nullable); participation reads document the 409
// errors.practices.attendanceRuleMissing contract.
export const SWAGGER_VERSION = '1.4.0';
export const SWAGGER_BEARER_NAME = 'jwt';
export const SWAGGER_PERSIST_AUTHORIZATION = false;
