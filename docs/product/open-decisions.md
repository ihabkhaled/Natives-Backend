# Open product decisions

Unresolved product choices. An unresolved decision must **not** be hidden by an arbitrary
implementation choice — features remain disabled or explicitly flagged until a named decision, version,
effective date, owner, and approval exist. Legacy spreadsheet values are treated as **candidates**, not
final policy (see `11-SCHEMAS/legacy-business-rules.yaml` in the prompt pack).

| ID     | Decision                                                                  | Default until resolved                                      | Status |
| ------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| OD-001 | Production hosting and object-storage provider                            | Local/dev adapters only                                     | OPEN   |
| OD-002 | Email / SMS / push notification provider                                  | In-app notifications only; provider behind adapter          | OPEN   |
| OD-003 | Public registration allowed?                                              | Admin invitation only                                       | OPEN   |
| OD-004 | Final weighted formula for player/team overall score                      | Legacy weights as versioned **candidate** rule only         | OPEN   |
| OD-005 | Final points for WFDF accreditation                                       | `null` (disabled) — never guessed                           | OPEN   |
| OD-006 | Final badge thresholds above the legacy 450-point tier                    | Tiers >100/>200/>450 candidate; >649 disabled (broken #REF) | OPEN   |
| OD-007 | Do jersey and board-governance modules ship in the first release?         | Deferred / optional                                         | OPEN   |
| OD-008 | Are national ID values imported at all?                                   | **Do not import** (prohibited by default)                   | OPEN   |
| OD-009 | Match scorekeeping fully live vs post-match only in first release         | Post-match capable; live behind flag                        | OPEN   |
| OD-010 | Attendance denominator rule (excused excluded?) and late/absent penalties | Legacy candidate; versioned + admin-approved rule required  | OPEN   |

## Deferred to specific prompts

- Native bundle IDs, signing, icons, and splash assets → prompt **800** (branding). Display identity is
  set to "Ultimate Natives" from that prompt onward; the inherited template display name and bundle ID
  remain until then to keep the deep-link/env/identity test suite intact.
