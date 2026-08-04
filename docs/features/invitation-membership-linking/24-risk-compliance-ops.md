# UN-P0-INV risk, compliance, and operational readiness

| Risk                                                       | Severity | Treatment                                                                                                                   |
| ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Reconciliation links an account to the wrong roster record | High     | Single-candidate rule; ambiguous rows refused and reported; dry run default; every link audited and individually reversible |
| Operator runs `--apply` without reading the plan           | Medium   | Dry run is the default and requires no flag; the apply header names what it is doing; the runbook orders the steps          |
| Reconciliation partially applies                           | Low      | One transaction for the whole run; the CLI rolls back on any error                                                          |
| Stale client keeps writing email-less memberships          | Medium   | Expected until the deploy lands. Reconciliation is re-runnable, so a later pass repairs anything created in between         |
| Stale service worker makes the fix look ineffective        | Medium   | UAT-1 requires confirming the deployed build identity before testing                                                        |
| Role granted that should not be                            | Low      | Role comes from the invitation's ceiling-validated key; missing key throws                                                  |
| Personal data in operator logs                             | Low      | The CLI reports ids and status only, never the address                                                                      |

## Compliance

- No new personal data is collected. The address was already stored on the
  invitation; the repair puts the same value on the profile it belongs to.
- No retention or deletion policy changes.
- Repairs are auditable in `security_events` with `reconciliation: true`.

## Operational readiness

- **Monitoring**: repairs are queryable from `security_events`. No new dashboard
  or alert is warranted — this is an operator-invoked, one-off repair, not a
  running process.
- **Escalation**: ambiguous rows go to whoever owns the team's roster, since
  resolving them needs knowledge of who the people are.
- **Support**: `docs/identity.md` carries the symptom-to-cause mapping and the
  command.
- **On-call**: unchanged. Nothing here runs unattended.

## Readiness decision

Risks accepted for merge. Release remains blocked by the gates in
`22-go-no-go.md`.
