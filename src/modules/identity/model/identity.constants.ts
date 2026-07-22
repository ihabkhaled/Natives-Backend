import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Ports -------------------------------------------------------------------
export const SECURE_RANDOM_PORT = Symbol('SECURE_RANDOM_PORT');

// --- Routes & OpenAPI tags ---------------------------------------------------
export const AUTH_ROUTE = 'auth';
export const AUTH_API_TAG = 'auth';
export const AUTH_LOGIN_ROUTE = 'login';
export const AUTH_REFRESH_ROUTE = 'refresh';
export const AUTH_LOGOUT_ROUTE = 'logout';
export const AUTH_LOGOUT_ALL_ROUTE = 'logout-all';
export const AUTH_ME_ROUTE = 'me';
export const AUTH_SESSIONS_ROUTE = 'sessions';
export const AUTH_SESSION_REVOKE_ROUTE = 'sessions/:id/revoke';
export const AUTH_SESSIONS_REVOKE_OTHERS_ROUTE = 'sessions/revoke-others';
export const AUTH_PUBLIC_INVITATION_ROUTE = 'invitations/:token';
export const AUTH_FORGOT_PASSWORD_ROUTE = 'forgot-password';
export const AUTH_RESET_PASSWORD_ROUTE = 'reset-password';
export const AUTH_SESSION_ID_PARAM = 'id';

export const INVITATIONS_ROUTE = 'invitations';
export const INVITATIONS_API_TAG = 'invitations';
export const INVITATIONS_ACCEPT_ROUTE = 'accept';
export const INVITATIONS_RESEND_ROUTE = ':id/resend';
export const INVITATIONS_REVOKE_ROUTE = ':id/revoke';
export const INVITATION_ID_PARAM = 'id';

// Team-scoped invitation route: the `:teamId` path param lets the permission
// guard evaluate member.invite at TEAM scope, so a team administrator whose
// grant is team-scoped can invite into their own team (and only their own).
export const TEAM_INVITATIONS_ROUTE = 'teams/:teamId/invitations';
export const TEAM_ID_PARAM = 'teamId';

// --- Field bounds ------------------------------------------------------------
export const EMAIL_MAX_LENGTH = 320;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MAX_LENGTH = 120;
export const DEVICE_LABEL_MAX_LENGTH = 120;
export const OPAQUE_TOKEN_MIN_LENGTH = 20;
export const OPAQUE_TOKEN_MAX_LENGTH = 512;
export const SESSION_LIST_DEFAULT_LIMIT = 20;
export const SESSION_LIST_MIN_LIMIT = 1;
export const SESSION_LIST_MAX_LIMIT = 100;
export const SESSION_LIST_DEFAULT_OFFSET = 0;
export const UNKNOWN_DEVICE_LABEL = 'Unknown device';
export const UNKNOWN_APPROXIMATE_LOCATION = '';

// --- Scheduled maintenance ---------------------------------------------------
// The invitation-expiry sweep registered with the platform job seam: hourly is
// plenty for a TTL measured in days, and the sweep is idempotent and bounded.
export const INVITATION_EXPIRY_JOB_KEY = 'invitations.expiry';
export const INVITATION_EXPIRY_INTERVAL_MS = 3_600_000;

// --- Token generation --------------------------------------------------------
// 32 bytes of CSPRNG entropy, base64url-encoded, delivered out-of-band. Only the
// sha-256 hash is ever persisted; the plaintext is never stored, logged, or
// returned by the API.
export const MILLISECONDS_PER_SECOND = 1000;
export const SECURE_TOKEN_BYTE_LENGTH = 32;
export const OPAQUE_TOKEN_ENCODING = 'base64url' as const;
export const TOKEN_HASH_ALGORITHM = 'sha256' as const;
export const TOKEN_HASH_ENCODING = 'hex' as const;

// --- Anti-enumeration --------------------------------------------------------
// A fixed valid bcrypt digest compared against when no credential exists, so a
// missing account costs the same wall-clock time as a wrong password.
export const DUMMY_PASSWORD_HASH =
  '$2b$10$HobO1TciaomoWrP6K7hnguwCCqn9dOcwHZvC8NUs8//VK2md4KxPO';

// --- Generic recovery acknowledgement ----------------------------------------
export const RECOVERY_ACK_MESSAGE =
  'If an account matches, a password reset link has been sent.';
export const RESET_ACK_MESSAGE = 'Your password has been reset.';
export const LOGOUT_ACK_MESSAGE = 'Session revoked.';
export const LOGOUT_ALL_ACK_MESSAGE = 'All sessions revoked.';
export const SESSION_NOT_FOUND_MESSAGE = 'The session was not found';
export const SESSION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.sessionNotFound';
export const SESSION_CONTEXT_REQUIRED_MESSAGE =
  'The access token is missing current-session context';
export const SESSION_CONTEXT_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.sessionContextRequired';

// --- Error messages & keys ---------------------------------------------------
export const INVALID_CREDENTIALS_MESSAGE = 'Credentials are invalid';
export const INVALID_CREDENTIALS_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.invalidCredentials';

export const INVALID_REFRESH_TOKEN_MESSAGE = 'The refresh session is invalid';
export const INVALID_REFRESH_TOKEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.auth.invalidRefreshToken';

export const INVITATION_INVALID_MESSAGE = 'The invitation is no longer valid';
export const INVITATION_INVALID_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.invitationInvalid';

export const INVITATION_NOT_FOUND_MESSAGE = 'The invitation was not found';
export const INVITATION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.invitationNotFound';

export const INVITATION_CONFLICT_MESSAGE =
  'An active invitation or account already exists for this email';
export const INVITATION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.invitationConflict';

export const RESET_TOKEN_INVALID_MESSAGE = 'The reset token is invalid';
export const RESET_TOKEN_INVALID_MESSAGE_KEY: ErrorMessageKey =
  'errors.identity.resetTokenInvalid';
