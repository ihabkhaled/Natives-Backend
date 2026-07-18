# 19 Threat model

## Scope, assets, and trust boundaries

Assets are refresh-session ownership and revocation state, opaque invitation tokens and their hashes, invited
email/role data, JWT claims, and security-event integrity. Trust boundaries are:

1. Public HTTP input to validated controller DTOs and authentication guards.
2. Authenticated identity claims to owner-scoped application operations.
3. Application use cases to transactional repositories.
4. Parameterized SQL to PostgreSQL.

## Threat and abuse scenarios

| Threat                                               | Mitigation                                                                                                                                                                                                   | Residual risk                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| IDOR revokes another user's session                  | Update predicate binds both session ID and caller user ID; missing and foreign rows return the same 404                                                                                                      | UUID observation does not reveal ownership                                                |
| Mass revocation accidentally revokes current session | Current refresh-session ID is signed into new JWTs and excluded in SQL                                                                                                                                       | Legacy JWTs cannot use revoke-others and receive a sanitized 401                          |
| Session enumeration or unbounded reads               | Authentication, permission guard, owner predicate, active/expiry filter, limit `1..100`, deterministic offset page                                                                                           | Offset pagination can become stale during concurrent logins                               |
| Invitation brute force or enumeration                | 32-byte opaque tokens, hash-only lookup, global throttling, generic invalid-state error                                                                                                                      | A stolen valid bearer token reveals the invitation's minimal email/role projection        |
| Raw token leakage                                    | Only SHA-256 token hashes are queried/stored; responses, audits, and errors never include tokens; the HTTP request serializer replaces the invitation path token and censors request referrers before output | Logger regression coverage must remain green because invitation tokens are bearer secrets |
| SQL injection                                        | Every dynamic value is a bound parameter; order and projection are static                                                                                                                                    | None identified                                                                           |
| Race between refresh and revoke                      | Existing transaction boundaries and refresh `FOR UPDATE` locking remain authoritative                                                                                                                        | A short-lived access JWT remains valid until expiry after its refresh row is revoked      |
| Privacy expansion through device/location tracking   | Only the caller-supplied device label is shown; location is deliberately empty; no IP or fingerprint is stored                                                                                               | Device labels are user-controlled display text and must remain escaped by clients         |

## Residual-risk decision

No critical or high residual risk was identified. Bearer tokens in public invitation URLs and access-token
expiry after refresh revocation are existing architectural constraints. They require secure transport, the
tested request-URL serializer, restricted log access, and short access-token TTLs; they do not justify a
parallel token system in this slice.
