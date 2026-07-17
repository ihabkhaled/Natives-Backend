# 07 - Technical Roadmap

## Purpose

Define the engineering execution phases and sequence them into safe, reviewable slices.

## Step-by-Step Workflow

1. Break implementation into small milestones.
2. Define branch and merge strategy.
3. Define schema evolution order.
4. Define rollout and rollback order.
5. Ensure each slice is independently reviewable where possible.

## Engineering Milestones

| Milestone | Description | Dependencies | Merge criteria |
| --------- | ----------- | ------------ | -------------- |
| 1         |             |              |                |
| 2         |             |              |                |
| 3         |             |              |                |

## Branch / Merge Strategy

[Describe trunk-based, short-lived branches, release branches, or other local strategy. Explain how reviewability is preserved.]

## Schema Evolution Plan

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Rollout Sequence

1. [Environment or slice 1]
2. [Environment or slice 2]
3. [Environment or slice 3]

## Rollback Sequence

1. [Rollback trigger]
2. [Rollback step]
3. [Validation after rollback]

## Feature Flag and Compatibility Notes

[Describe compatibility periods, versioning, dual-write, read-after-write concerns, toggle ownership, or sunset steps.]

## Exit Checklist

- [ ] Milestones defined
- [ ] Merge strategy documented
- [ ] Schema evolution order defined
- [ ] Rollout order defined
- [ ] Rollback order defined

## Evidence And References To Attach

- branch strategy or merge policy references
- migration order references
- rollout dependency diagrams or sequencing notes where relevant

## Phase Blockers

Do not close this phase if:

- implementation slices are too large to review safely
- schema or contract evolution order is still unclear
- rollback order is missing for risky changes
- the roadmap cannot be followed step by step
