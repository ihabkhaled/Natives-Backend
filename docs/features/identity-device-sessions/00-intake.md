# 00 Intake — Identity device sessions

- Request ID: `UN-101-SESSIONS`
- Type: critical authentication feature completion
- Source: production prompt 101 and the existing frontend auth contract
- Owners: Identity backend owner; QA and AppSec approval required before release
- Urgency: high; the client already presents session-management controls
- Affected domains: identity, auth token claims, refresh-session persistence, public invitation lookup
- Delivery track: standard critical-risk lane on `feat/ultimate-natives-completion`
- Critical flags: authentication, token lifecycle, ownership/IDOR, public token lookup, PII
- Scope: list the caller's active refresh sessions, revoke one owned session, revoke all other
  sessions, and inspect a pending invitation through its opaque token.
- Out of scope: device fingerprinting, IP/geolocation tracking, schema migration, social login, and
  fabricated team context.
