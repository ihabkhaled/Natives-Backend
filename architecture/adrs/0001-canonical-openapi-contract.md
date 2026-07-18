# ADR 0001: Canonical OpenAPI contract

- Status: Accepted
- Date: 2026-07-18
- Deciders: Architecture and API owners

## Context

The frontend and backend have independent Git histories. Handwritten route and DTO declarations had
already drifted, and duplicate DTO class names silently overwrote Swagger component schemas.
Generating from a running remote service would make builds depend on network and database state.

## Decision

`createOpenApiDocument` is the single Swagger document factory. It assigns stable operation IDs and
the artifact serializer recursively sorts object keys before writing `contracts/openapi.json` and
its SHA-256 sidecar. `npm run contract:check` is read-only and CI rejects byte or checksum drift.

The compatibility classifier treats removal or modification of an existing operation/schema
conservatively as breaking. Additions and deprecations are reported separately. The frontend copies
the exact bytes and generates private TypeScript declarations while keeping runtime Zod validation.

## Consequences

**Positive:** Both repositories compile against one versioned contract, public/auth metadata is
repeatable, and duplicate component names become test failures rather than silent runtime drift.

**Negative:** Intentional breaking changes need a coordinated artifact update and rollout. Document
generation still constructs the Nest application, although database unavailability is fail-soft.

## Alternatives considered

- Runtime Swagger fetching: rejected because it is nondeterministic and couples builds to a service.
- Shared package/monorepo: rejected because repository histories and releases must remain independent.
- Handwritten frontend DTO types: rejected because they preserve the original drift.

## Supersession

Revisit when a signed artifact registry can publish versioned contracts and compatibility reports to
both repositories without coupling their builds.
