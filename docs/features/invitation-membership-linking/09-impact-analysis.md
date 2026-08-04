# UN-P0-INV impact analysis

| Area                        | Impact                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natives-App members module  | Types, gateway, service, hook, and their tests                                                                                                                                                                                      |
| Natives-App MSW fake server | Records both addresses so a test can compare them; invitation handlers and actor helpers extracted to their own files to stay inside the module size rule                                                                           |
| Natives-App routing         | `/workbench` is no longer registered in production builds                                                                                                                                                                           |
| Natives-Backend             | New reconciliation routine, CLI, npm script, and specs. No existing code path changed                                                                                                                                               |
| Database                    | No schema change. `--apply` writes `member_profiles.email`, `memberships.user_id` / `status` / `joined_at` / `version`, `membership_status_events`, `user_role_assignments`, and `security_events`, and bumps `rbac_policy_version` |
| OpenAPI contract            | Unchanged. `profile.email` was already published in 1.7.0                                                                                                                                                                           |
| Backward compatibility      | The client repair sends an optional field the server already accepts. Older clients keep working — incorrectly — until they are updated                                                                                             |
| Support                     | New runbook entry mapping "empty menu / Practice forbidden" to this cause and to the repair command                                                                                                                                 |
| Observability               | Every repair is visible in `security_events` with `reconciliation: true`, carrying the invitation, membership, and team ids                                                                                                         |

## Not affected

Authentication, sessions, refresh rotation, password recovery, and the
acceptance use case itself are untouched.

## Migration

None required. The reconciliation is a data repair, not a schema change, and is
safe to run repeatedly: a second run finds nothing because the profile now
carries the address.
