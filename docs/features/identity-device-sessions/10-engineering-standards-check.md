# 10 Engineering standards check

- Canonical policy, architecture map, non-negotiable rules, prompt 101, identity README, controller,
  DTO, security, unit/integration-test, and final-validation playbooks reviewed.
- Simple Code Ladder: reuse existing identity repository/use-case/audit/JWT owners; no dependency,
  migration, fingerprint abstraction, or parallel token system.
- Controllers remain one delegation; SQL values are bound; owner scope precedes count/order/page.
- Boundary strings and page sizes are validated; IDs are UUID-piped; token lookup is hash-only.
- Errors use typed sanitized `AppError` message keys; no token/email/device context enters audits.
- Pino request serialization must replace the public invitation path token
  before output while retaining method, sanitized route, and request id.
- Tests precede implementation and critical touched behavior targets near-complete branch coverage.
- No permanent rule change was discovered; canonical policy files remain unchanged.
