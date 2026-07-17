# Company SDLC Policy

## Purpose

This document defines the company-wide delivery operating model. It applies to all software and system changes, whether the work targets a new product, an existing product, an internal platform, a shared service, a customer-facing workflow, or infrastructure.

## Policy Statement

- No phase may be skipped.
- Depth may scale by request size, but the gate itself never disappears.
- No implementation starts before phases `00` through `13` are documented.
- No merge happens without review, tests, updated docs, and rollout or rollback readiness.
- No release happens without QA, security validation, business validation, risk review, and release approval.
- Every phase writes artifacts into the repository.

## Operating Principles

1. Visibility beats assumption.
2. Written artifacts beat memory.
3. Tested behavior beats confidence.
4. Reviewed changes beat isolated heroics.
5. Reversible releases beat optimistic releases.
6. Organizational learning is part of delivery, not a side activity.

## Scope

This policy covers:

- features
- enhancements
- bug fixes
- refactors
- migrations
- API changes
- database changes
- security fixes
- performance work
- compliance changes
- infrastructure changes
- workflow changes
- AI behavior changes

## Delivery Tracks

### Standard Track

Use for normal delivery. All phases run in order with standard approval timing.

### Hotfix Track

Use only for production-impacting incidents, urgent legal obligations, major security issues, or blocking business-critical defects. Hotfixes still require all phases and artifacts, but teams may compress meetings, use accelerated approvals, and complete documentation in near-real-time rather than through long planning cycles.

## Roles and Responsibility Mapping

| Responsibility       | Typical role                                          |
| -------------------- | ----------------------------------------------------- |
| Request intake owner | Delivery lead, PM, EM, or triage lead                 |
| Business owner       | Product owner, business analyst, stakeholder sponsor  |
| Technical owner      | Engineering lead, architect, senior engineer          |
| Quality owner        | QA lead or quality engineering lead                   |
| Security owner       | AppSec lead, security engineer, security reviewer     |
| Operations owner     | SRE lead, DevOps lead, platform lead                  |
| Release approver     | Release manager, EM, product lead, delegated approver |

If local titles differ, document the mapping explicitly and keep it updated.

## Request ID Standard

Use a globally unique request identifier. Recommended format:

```text
REQ-YYYY-TEAM-####
```

Example:

```text
REQ-2026-PLATFORM-0042
```

## Severity and Urgency

Document both severity and urgency during intake.

### Severity

- `SEV-1`: production outage, material customer harm, security breach, or data loss
- `SEV-2`: major feature blocked, major degradation, urgent client impact
- `SEV-3`: moderate impact, workaround exists
- `SEV-4`: low impact improvement, cleanup, or planned enhancement

### Urgency

- `Immediate`: work begins now
- `This sprint`: planned urgent work
- `Planned`: normal prioritization
- `Backlog`: intentionally deferred

## Mandatory Phase Sequence

1. `00` Request intake and classification
2. `01` Business analysis
3. `02` Business development / commercial impact
4. `03` Product requirements
5. `04` Cross-functional refinement
6. `05` Delivery planning
7. `06` Technical refinement
8. `07` Technical roadmap
9. `08` Architecture review
10. `09` Impact analysis
11. `10` Engineering standards check
12. `11` Test strategy
13. `12` Coverage plan
14. `13` Implementation readiness
15. `14` Implementation
16. `15` Developer validation
17. `16` Internal bug loop
18. `17` QA validation
19. `18` QA defect loop
20. `19` Security review
21. `20` UAT
22. `21` Client approval
23. `22` Go / no-go
24. `23` Documentation updates
25. `24` Risk / compliance / ops review
26. `25` Release
27. `26` Hypercare
28. `27` Retrospective and postmortem

## Phase Exit Rules

- A phase exits only when its artifact exists, required sections are filled, risks are visible, and the named owner accepts the output.
- A later phase may refine an earlier phase, but it may not silently replace it.
- Missing information must be documented as assumptions or open questions, not ignored.

## Minimum Expectations For Every Phase

Every phase must identify:

- purpose
- owner
- inputs
- outputs
- assumptions
- open questions
- risks
- evidence or references
- exit decision

If any of these are absent for a materially important phase, the phase is incomplete.

## Hard Gates

- No coding before phases `00` through `13`
- No PR without tests
- No PR without doc updates when behavior changes
- No merge below touched-module coverage threshold without waiver
- No merge if automation gates fail
- No release without QA sign-off
- No release without security sign-off when applicable
- No release without rollback readiness
- No release without monitoring and alerting
- No release without required business or client sign-off
- No release without recorded go / no-go decision

## Signs The Process Is Being Bypassed

The policy is being violated when any of the following appear:

- implementation started before early artifacts exist
- acceptance criteria are vague or missing
- architecture impact was "understood verbally" but not written
- tests are justified with "we checked it manually once"
- docs are postponed until after release
- open defects are hidden in chat, not in artifacts
- support or operations first learn about the change after deployment
- rollback is described as "we can revert somehow"
- risk is described emotionally instead of concretely

## Waivers and Exceptions

- Waivers are rare and time-bound.
- Every waiver must name the approver, business reason, risk, compensating controls, and expiration date.
- Waivers may reduce threshold or sequencing pressure, but may not erase traceability.
- All waivers must be recorded in the relevant phase document and in the go / no-go record.

## Hotfix Guardrails

Hotfixes still require:

- request classification
- problem statement
- explicit risk assessment
- rollback plan
- validation evidence
- post-release documentation completion
- retrospective review

Hotfixes may move faster, but they may not become undocumented improvisation.

## Required Supporting Baselines

Every team implementing this policy must also maintain:

- engineering standards
- code review checklist
- release checklist
- security baseline
- QA baseline
- UAT baseline
- risk baseline
- documentation baseline

## Success Condition

The policy is working when no release surprises QA, security, support, operations, or the customer because all relevant work was made explicit before the change shipped.

## Failure Condition

The policy has failed when the organization repeatedly learns about important behavior only through production incidents, support escalation, or post-release confusion.
