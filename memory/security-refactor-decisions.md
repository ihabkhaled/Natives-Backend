# Security Refactor Decisions

## Decision: minimum safe code

Security refactors may simplify structure but never remove authentication, permission authorization, ownership/tenant defense, typed failures, bounds, redaction, startup secret validation, or tests.

## Decision: security vendors stay behind ports

JWT signing/verification and password hashing/comparison are external implementation details. Application services and guards depend on app-owned ports; adapters alone import vendor packages, and decoded payloads are runtime-validated.

## Decision: central permission ownership

Roles and permissions are enums; one server-owned role→permission map derives effective permissions. Protected routes declare permissions and never compare raw role/permission strings.

## Decision: scope before pagination and count

Owner/tenant identity comes from the verified token and is a required repository input. Scope is applied before sort, pagination, and total calculation; out-of-scope resource ids do not reveal existence.

## Decision: failures remain typed and sanitized

Missing/invalid identity and denied permission use auth-owned `AppError` message keys. Tokens, passwords, secrets, vendor errors, and stacks never reach responses or logs.

**See:** [security-decisions.md](./security-decisions.md) · [skills/cleanup-security-code-without-weakening.md](../skills/cleanup-security-code-without-weakening.md).
