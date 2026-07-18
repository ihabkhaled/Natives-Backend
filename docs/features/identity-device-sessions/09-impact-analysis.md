# 09 Impact analysis

- Backend/API: additive identity routes and an optional JWT payload field.
- Frontend/mobile: can replace session/invitation mocks after consuming regenerated OpenAPI.
- Data: reads and revocations use existing rows; no migration/backfill.
- Compatibility: old access tokens still authenticate; revoke-others is safely unavailable without
  a current-session claim.
- Security/privacy: stronger incident response; no new location, IP, PII, token, or fingerprint storage.
- Monitoring/support: existing security events gain distinct revoke-one/revoke-others actions.
- CI/contracts: route changes require later OpenAPI regeneration by the root contract workstream.
- Infrastructure/config/analytics/compliance/training: not applicable; no runtime surface changes.
