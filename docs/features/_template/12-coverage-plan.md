# 12 - Coverage Plan

## Purpose

Define the measurable coverage gate for touched modules and guard against coverage theater.

## Policy

- Minimum touched-module coverage: `95%` lines, branches, functions, and statements
- Critical logic must be near-complete and scenario-rich
- Global repository average is not an acceptable substitute for weak touched-module coverage

## Touched Module Coverage Targets

| Module / area | Lines | Branches | Functions | Statements | Notes |
| ------------- | ----- | -------- | --------- | ---------- | ----- |
|               | 95%   | 95%      | 95%       | 95%        |       |

## Critical Scenario Areas

- auth and permissions
- calculations and business rules
- money flow or billing
- data transformations
- privacy-sensitive logic
- migrations and rollback
- tenant isolation
- external integration error handling

## Coverage Evidence Plan

- Tooling used:
- Report location:
- How touched modules will be identified:
- How branch gaps will be reviewed:

## Waiver Section

| Field                 | Value    |
| --------------------- | -------- |
| Waiver needed         | yes / no |
| Reason                |          |
| Compensating controls |          |
| Approver              |          |
| Expiration date       |          |

## Exit Checklist

- [ ] Coverage thresholds defined
- [ ] Touched modules listed
- [ ] Critical scenario areas called out
- [ ] Waiver status documented

## Evidence And References To Attach

- coverage command or tooling reference
- report location
- touched-module identification method
- waiver approval reference if needed

## Phase Blockers

Do not close this phase if:

- coverage is described only as a repo-wide average
- critical scenario areas are not explicitly called out
- a waiver is needed but has no approver or expiration date
