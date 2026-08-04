# UN-P0-INV security review

| Checklist area       | Finding                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AuthN / AuthZ        | Unchanged. The invite endpoints keep their existing permission guards and team scope                              |
| Privilege escalation | Reconciliation grants only the invitation's own ceiling-validated role; see T2 in `19-threat-model.md`            |
| Injection            | All SQL parameterized; verified against real PostgreSQL                                                           |
| Secrets              | None introduced. No credential, token, or link is logged by the CLI                                               |
| PII in logs          | The CLI reports invitation, membership, and team ids and the invitation status. It does not print email addresses |
| Input validation     | `PlayerProfileDto.email` is `@IsEmail()` and length-bounded; the client also validates before submit              |
| Audit                | Every repair writes `security_events`. Dry run writes nothing                                                     |
| Exposure             | `/workbench` no longer registered in production builds                                                            |
| Dependencies         | None added                                                                                                        |

## Note on CLI output

An earlier draft of the report line printed the invited address. It does not:
the address is the one piece of personal data in the record set, and operator
terminals and CI logs are the wrong place for it. Ids are enough to act on, and
they join back to the row.

## Decision

**Approved** for the scope delivered, with the residual risk in
`19-threat-model.md` (T1) explicitly accepted and mitigated by mandatory dry-run
review.
