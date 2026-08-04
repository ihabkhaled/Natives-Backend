# UN-P0-INV hypercare

Not applicable yet — nothing has been released, so there is nothing to watch.

## What to watch when it does ship

Hypercare window: the first week after deployment, and the 24 hours after any
`--apply` run.

| Signal                                                                   | Where                  | What is wrong if it moves                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accepted team invitations whose account holds no membership in that team | Reconciliation dry run | Should be zero after the repair. A non-zero count means invitations are still being written without the address — likely a stale client bundle         |
| `security_events` with `reconciliation: true`                            | Database               | Should only appear during a deliberate `--apply`. Any other time means the CLI ran unintentionally                                                     |
| Support reports of empty navigation or forbidden Practice                | Support queue          | Should stop. If they continue, check the deployed build identity before re-diagnosing — a stale service worker reproduces the original symptom exactly |
| Rows reported `ambiguous`                                                | Reconciliation dry run | Each is a person still stranded. They need manual resolution; they do not resolve themselves                                                           |

## Exit criteria

Two consecutive clean dry runs and no new reports of the symptom.
