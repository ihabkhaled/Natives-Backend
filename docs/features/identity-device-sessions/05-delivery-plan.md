# 05 Delivery plan

1. Pin repository, mapper, JWT-claim, use-case, controller, and HTTP behaviors in tests.
2. Add session-aware signed identities while accepting legacy claims.
3. Add bounded owner-scoped repository queries and invitation-token read.
4. Add application operations, DTOs, controller routes, and DI wiring.
5. Update identity documentation and validation/security evidence.

Dependencies are the existing identity migration, unit-of-work port, JWT adapter, and security audit
service. No feature flag is needed because the routes are additive. Rollback removes the additive routes
and optional claim; persisted sessions remain compatible. AppSec and QA approval remain release gates.
