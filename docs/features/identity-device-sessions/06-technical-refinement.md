# 06 Technical refinement

The selected design reuses `refresh_sessions`, `invitations`, `RefreshSessionRepository`,
`SecurityAuditService`, and the JWT app-owned port. Newly issued access tokens carry optional
`sessionId`; validator compatibility permits pre-deployment tokens until they expire. Session listing
uses `issued_at` as the only truthful last-known activity and a fallback device label, avoiding IP or
fingerprint collection. Owner scope is applied in SQL before order/count/pagination.

Alternatives rejected:

- Inferring the current device from newest issuance is race-prone.
- Accepting a refresh token for list/revoke exposes extra secret material to routine routes.
- Adding IP/geolocation/last-seen columns is invasive and unnecessary for prompt 101.
- Returning a team name is false because the invitation schema has no team foreign key.
- Returning all rows unpaged violates the bounded-list policy.

No schema or new dependency is required.

The HTTP logger must sanitize the invitation-token path segment before pino
serializes the request. The selected approach extends the existing logger owner
with a pure URL sanitizer and request serializer, preserving the method,
sanitized route, request id, headers, and response timing while replacing only
the opaque token segment. Dropping all request URLs was rejected because it
would remove useful route-level diagnostics; changing the public route was
rejected because transport logging can enforce the security boundary centrally.
