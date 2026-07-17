# QA Baseline

## Purpose

This document defines the minimum QA operating model for independent validation.

## QA Expectations

- QA works from documented requirements, acceptance criteria, architecture notes, and test strategy.
- QA is independent from implementation validation.
- QA validates both specified behavior and risky real-world behavior.
- QA evidence must be traceable to the request ID.

## QA Preparation Checklist

Before QA starts, the following should be available:

- request summary
- acceptance criteria
- test strategy
- environment access
- test accounts or seed data
- known risks
- known limitations
- expected rollout audience and behavior

## Minimum QA Coverage

- happy paths
- unhappy paths
- edge cases
- boundary cases
- regression scope
- permissions or role cases
- data validation
- workflow continuity across systems
- user-visible content and error states

## QA Inputs

- product requirements
- acceptance criteria
- delivery plan
- architecture review
- test strategy
- test data
- environment notes
- known risks and open limitations

## QA Outputs

- defects with reproducible steps
- severity and priority
- evidence
- environment
- pass or fail status by scenario
- final QA sign-off or rejection

## QA Evidence Expectations

QA evidence should be concrete enough that another person could understand what was actually exercised:

- scenario identifiers
- executed steps
- observed results
- screenshots or recordings when useful
- request or response samples when useful
- linked defects for failures

## QA Exit Rule

QA sign-off requires all blockers resolved or explicitly accepted by authorized approvers with documented risk.

## QA Failure Signals

QA is being treated weakly when:

- only happy paths are tested
- defects are reported without repro steps
- test data is improvised and undocumented
- failures are marked "probably environmental" with no follow-up
- retests happen without updating evidence
