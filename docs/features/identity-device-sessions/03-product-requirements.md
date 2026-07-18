# 03 Product requirements

## User stories and acceptance criteria

- As an authenticated user, I can list only my active, unexpired sessions in deterministic newest-first
  pages bounded to 100 rows.
- Each row contains an ID, conservative user-supplied device label, issued time as last-known activity,
  and whether it matches the access token's session claim. No location or fingerprint is collected.
- I can revoke one session only when it belongs to me; missing and foreign IDs return the same typed
  not-found response.
- I can revoke all other active sessions while preserving the current session. A legacy access token
  without a session claim receives a sanitized unauthorized response instead of revoking everything.
- A public caller possessing a valid pending invitation token can read its email, role, expiry, and
  optional inviter display name. Invalid, used, revoked, or expired tokens return one generic error.
- Session mutations append privacy-safe security events without logging tokens, emails, or device data.

Error, empty, and permission states are HTTP-contract concerns; no user-facing prose is added outside
existing message-key handling. Analytics and localization changes are not applicable at this backend
slice. Team name is a non-goal because invitations currently have no team relationship.
