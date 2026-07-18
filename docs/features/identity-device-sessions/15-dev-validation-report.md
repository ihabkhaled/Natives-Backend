# 15 Developer validation report

Date: 2026-07-18. Reviewer: Identity implementation owner.

## Summary

The identity slice is implemented and internally coherent. Newly issued access tokens identify their
refresh-session row; authenticated callers can list active owned sessions, revoke one owned session, and
revoke every other session. A holder of a valid pending invitation token can inspect the minimal invitation
projection. No schema, dependency, location tracking, fingerprinting, or token logging was introduced.

## Evidence

| Validation                                               | Result                                                |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Identity unit regression (`43` files, `231` tests)       | Pass                                                  |
| Focused touched-logic coverage (`11` files, `74` tests)  | Pass; 100% statements, branches, functions, and lines |
| Complete PostgreSQL identity E2E regression (`17` tests) | Pass                                                  |
| Exact-file ESLint                                        | Pass                                                  |
| Exact-file Prettier check                                | Pass                                                  |
| TypeScript typecheck                                     | Pass                                                  |
| Production build                                         | Pass                                                  |
| Scoped `git diff --check`                                | Pass                                                  |
| `npm audit --audit-level=high`                           | Pass; zero vulnerabilities                            |
| Sensitive URL sanitizer regression (`9` tests)           | Pass; 100% statements, branches, functions, and lines |
| Real pino HTTP log capture                               | Pass; token absent, route/method/request ID retained  |

Environment evidence used Node `v24.14.1` and npm `10.7.0`. This is below the repository-declared Node
`>=24.18.0` and npm `>=11.16.0`, so the root release pipeline must repeat the gates on the canonical
toolchain.

## Functional and operational checks

- Active/unexpired filtering, deterministic ordering, pagination bounds, and owner scoping are asserted
  at repository and HTTP layers.
- The access-token session is marked current; revoke-others preserves it and rejects legacy claims that
  cannot identify a current session.
- A foreign session ID receives the same not-found response as a missing ID and remains unchanged in
  PostgreSQL.
- Invitation tokens are hashed before lookup; invalid, accepted, revoked, and expired states use the same
  sanitized error path.
- The HTTP request serializer replaces only a public invitation URL's bearer-token segment before pino
  receives it, and request referrer headers are censored. The regression suite captures a real HTTP request
  log and proves both raw token forms are absent while the sanitized URL, request method, and correlation ID
  remain available.
- Revocations use the existing transactional security-audit service. Audit context contains IDs and counts,
  never raw tokens, email addresses, device labels, IP addresses, or location data.

## Integration status

An overlapping stale `/auth/me` assertion was updated by the root integration owner and the complete identity
E2E file now passes. This slice still does not claim the whole-repository gate is green because other
workstreams remain active in the shared working tree.
