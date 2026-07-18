# 09 — Impact Analysis

| Area            | Impact                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Backend/runtime | Runtime no longer attempts database creation.                                                    |
| API/client      | Breaking login response nesting and new enriched user payload.                                   |
| Database        | No schema change; explicit setup may create the configured database.                             |
| Auth/RBAC       | Successful login resolves effective permission keys.                                             |
| Config/secrets  | Seed password becomes required only for the seed command and is never defaulted.                 |
| CI/tests        | Unit, database integration, and identity E2E consumers require updates.                          |
| Operations/docs | Setup order and least-privilege requirement are documented.                                      |
| Observability   | Setup reports success/failure without credentials; runtime retains connection/readiness logging. |

Not affected: queues, caches, reporting, analytics, legal retention, localization, and health response schemas.

Backward compatibility: intentionally broken for login only; no migration can make old clients compatible, so coordinated deployment is required.
