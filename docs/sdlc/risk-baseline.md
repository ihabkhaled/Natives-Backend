# Risk Baseline

## Purpose

This document defines how risk is identified, documented, reviewed, and accepted.

## Risk Categories

- business risk
- customer risk
- technical risk
- security risk
- privacy risk
- operational risk
- compliance or legal risk
- reputational risk
- migration risk
- release risk

## Risk Handling Model

1. Identify the risk.
2. Describe trigger and impact.
3. Estimate likelihood and severity.
4. Define mitigation.
5. Define owner.
6. Define contingency or rollback.
7. Reassess before release.

## Risk Review Cadence

Risk should be reviewed at least during:

- intake
- delivery planning
- architecture review
- security review when applicable
- go / no-go
- retrospective for escaped issues

## Required Risk Fields

| Field       | Description                        |
| ----------- | ---------------------------------- |
| Risk ID     | Unique identifier                  |
| Description | Short statement of the risk        |
| Trigger     | What would cause the risk to occur |
| Impact      | Business or technical consequence  |
| Likelihood  | Low, medium, high                  |
| Severity    | Low, medium, high, critical        |
| Mitigation  | Preventive action                  |
| Contingency | What to do if it happens           |
| Owner       | Named person                       |
| Status      | Open, mitigated, accepted, closed  |

## Risk Acceptance

- Only authorized approvers may accept material risk.
- Accepted risk must be visible in go / no-go records.
- Time-bound or conditional acceptance is preferred over permanent acceptance.

## Common Risk Mistakes

- describing risk vaguely without trigger or impact
- assuming low likelihood means low importance
- forgetting operational and support risk while focusing only on technical risk
- accepting risk with no owner or expiration
- treating rollback absence as a normal condition
