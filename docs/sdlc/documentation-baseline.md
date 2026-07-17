# Documentation Baseline

## Purpose

Documentation must change with the software. This baseline defines what must be updated and when.

## Documentation Principles

- Docs are part of the deliverable.
- Behavior changes require documentation changes.
- Operator-facing changes require runbook and support updates.
- Architecture changes require architecture updates and possibly ADRs.
- User-facing changes require release notes and user guidance when applicable.

## Documentation Ownership Rules

- every changed behavior must have an identified documentation owner
- no one may defer documentation indefinitely without recorded approval
- support, operations, and onboarding documentation matter as much as engineering-facing documentation when the change affects them

## Documentation Types to Review

- `claude.md`
- architecture docs
- API docs
- data or schema docs
- runbooks
- QA docs
- security docs
- support docs
- onboarding docs
- migration docs
- release notes
- user documentation

## Definition of Updated

A document is updated only when it:

- reflects the new behavior accurately
- removes now-wrong old behavior
- includes new operational or support expectations
- identifies any new risks, flags, or constraints

## Minimum Documentation Review Questions

- what behavior changed
- who is affected
- what must future engineers know
- what must support know
- what must operators know
- what commands, dashboards, flags, or runbooks changed
- what assumptions are no longer true

## Documentation Exit Rule

No change is done if a future engineer, operator, support agent, or auditor would still need tribal knowledge to understand what changed and how to work with it.

## Documentation Failure Signals

- the release notes say something different from the product
- runbooks assume old behavior
- support learns about the change from customer tickets
- architecture docs describe a system that no longer exists
