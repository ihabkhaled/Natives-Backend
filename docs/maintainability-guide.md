# Maintainability Guide

IronNest optimizes for one obvious owner and one obvious flow.

## Method and file discipline

- Controller: transport metadata and exactly one application delegation.
- Service: one focused capability, recipe-like, at most the configured 20 lines per method.
- Use case: visible orchestration/transaction/post-commit sequence.
- Domain: pure decisions and invariants.
- Repository: parameterized, stable-ordered, owner/tenant-scoped, bounded persistence.
- Adapter: one external capability and normalized app-owned types.

Drain misplaced policy, mapping, vendor calls, and declarations before splitting. Split only when multiple current responsibilities remain. A facade over one collaborator is usually removable; a module public service that protects a private repository boundary may be justified and documented.

## Helper test

Extract when the same meaningful logic would be edited in several places, a security decision needs central tests, or a layer budget reveals the true owner. Keep one obvious line direct.

## Ownership and public surfaces

Use `model/`, `api/dto/`, `lib/`, `domain/`, `core/`, `config/`, and `shared/` according to [declaration ownership](./declaration-ownership.md). Export only contracts another module truly consumes.

## Change discipline

Characterize → move one responsibility → update wiring/exports/docs → delete old owner → focused test → full gates. Keep behavioral improvements distinct and explicit.
