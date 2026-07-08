# 08 - Architecture Review

## Purpose

Verify that the planned solution fits the current architecture or intentionally evolves it with documented decisions.

## Step-by-Step Workflow

1. Re-read architecture docs, domain boundaries, workflows, and service ownership.
2. Compare the proposed design to current patterns and constraints.
3. Identify contract, ownership, data-flow, or topology changes.
4. Decide whether ADRs are required.

## Current Architecture Context

[Describe the relevant current architecture, services, modules, or platform components that frame the change.]

## Architecture Impact

| Area                        | Impact | Notes |
| --------------------------- | ------ | ----- |
| Domain boundaries           |        |       |
| Service ownership           |        |       |
| API contracts               |        |       |
| Data flow                   |        |       |
| Event flow                  |        |       |
| Deployment topology         |        |       |
| Shared libraries or modules |        |       |

## Design Pattern Fit

[Explain how the proposal aligns with or intentionally changes current design patterns.]

## Required ADRs

| ADR needed | Title | Owner | Status  |
| ---------- | ----- | ----- | ------- |
| yes / no   |       |       | pending |

## Architecture Risks

- [Risk 1]

## Exit Checklist

- [ ] Architecture docs reviewed
- [ ] Impact documented
- [ ] Pattern fit documented
- [ ] ADR decision made
- [ ] Risks captured

## Sign-Off

| Role                        | Name | Decision         | Date |
| --------------------------- | ---- | ---------------- | ---- |
| Architect / technical owner |      | approve / revise |      |

## Evidence And References To Attach

- relevant architecture docs and ADR links
- diagrams, ownership maps, or data-flow references
- references to contracts or modules whose boundaries are affected

## Phase Blockers

Do not close this phase if:

- architecture fit is assumed but not explained
- ownership changes are still implicit
- an ADR is needed but was deferred without a decision
- cross-boundary effects are still unclear
