# AI Agent Coding Style

AI agents follow the same IronNest rules as humans.

Before writing code:

1. Read `claude.md`, the request artifacts, architecture map, rule 00, the affected code, and its tests.
2. Run the Simple Code Ladder: need it → reuse owner → native/platform → existing adapter → small helper → direct code → justified abstraction.
3. Route declarations with [declaration-ownership.md](./declaration-ownership.md).
4. Write/adjust tests first for changed behavior.
5. Make one responsibility-sized safe change.
6. Run focused checks, then repository gates.

## Generated-code rejection criteria

Reject or rewrite generated output that introduces anonymous public contracts, direct vendor imports, raw role/permission/status strings, generic factories with one consumer, pass-through wrappers without a boundary, nested chains, hidden side effects, unbounded queries, raw framework errors, duplicated test setup, or documentation that copies canonical rule bodies.

Agents are lazy about code volume, never about reading, validation, security, authentication, authorization, ownership, tests, docs, observability, rollback, or architecture.

## Required handoff

Report actual changed files, tests and commands run, failed/unavailable gates, security/validation preservation, remaining blockers, and rollback. Never label local implementation as released, independently approved, or production-validated.

Canonical routes: [rules](../rules/README.md), [skills](../skills/README.md), [agent readiness](./agent-readiness.md), [known pitfalls](../memory/known-pitfalls.md).
