# Coverage plan

Touched modules: practices calendar/reminder domain, token adapter, repositories, application
services/use cases, controllers/DTOs, platform quiet-hours/routing/projection, and the additive
migration.

Target: at least 95% lines, statements, functions, and real branches per touched module; critical
token authorization, ICS privacy, quiet-hour override, dedupe, and retry branches near 100%.
Decorator-only synthetic branches follow the documented aggregate branch exception only.

Evidence: targeted Vitest coverage plus the repository `test:coverage` gate and database/E2E
integration suites. Waiver status: none.
