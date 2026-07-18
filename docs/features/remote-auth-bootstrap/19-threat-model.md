# 19 — Threat Model

## Assets and trust boundaries

- Administrator plaintext password at the process-environment boundary.
- Password hash and administrator/RBAC records at the PostgreSQL boundary.
- Login tokens and principal metadata at the public HTTP boundary.
- Database-creation authority at the operator boundary.

## Threats and controls

| Threat                                | Control                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| Predictable bootstrap credential      | No committed fallback; validated runtime-only password        |
| Password disclosure in logs           | Password is never logged or included in result/error messages |
| SQL injection through database name   | Strict identifier allowlist before quoted `CREATE DATABASE`   |
| SQL injection through seed values     | Bound parameters for every seed value                         |
| Partial administrator provisioning    | One transaction with rollback and release                     |
| Duplicate global admin assignments    | Existing active global assignment is checked before insert    |
| Excess runtime database privilege     | Normal startup never executes database creation               |
| Stale or inflated login authorization | Effective permissions are resolved through the core RBAC port |
| Internal status leakage               | Explicit exhaustive client-facing account-state mapping       |

## Residual risk

Operators must provide a unique secret through an appropriately protected
environment mechanism and restrict `db:setup` execution to trusted deployment
contexts. These are operational controls documented in the database and
identity runbooks.
