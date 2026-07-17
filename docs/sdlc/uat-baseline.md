# UAT Baseline

## Purpose

UAT confirms that the delivered change solves the real business problem in realistic usage.

## UAT Principles

- UAT is not a duplicate of engineering tests.
- UAT should be executed by business, operations, customer success, or domain users close to real usage.
- UAT must validate language, workflow fit, clarity, correctness, and operational usefulness.

## UAT Scenario Design Rules

- use real workflows rather than synthetic isolated clicks
- include at least one normal case, one edge case, and one failure or recovery case when relevant
- test language, wording, and business meaning, not only system response
- confirm whether the result is usable by non-engineers in the target audience

## Minimum UAT Questions

- Does the change solve the original pain point?
- Is the workflow understandable without engineering interpretation?
- Are instructions, labels, and outputs clear?
- Does the result match policy, process, and business rules?
- Are edge cases meaningful in real usage?

## UAT Output

- scenario list
- executed steps
- observed result
- expected result
- pass or fail
- feedback and change requests
- final sign-off status

## UAT Evidence Expectations

UAT should leave behind:

- named participants
- date of execution
- exact scenarios run
- observed business fit issues
- decisions on whether issues are blockers, polish, or follow-up work

## UAT Exit Rule

No release where business value is still uncertain for a business-critical or client-facing change.

## UAT Failure Signals

UAT has failed as a discipline when:

- business users cannot explain what was being validated
- the team treats UAT as a rubber stamp after engineering sign-off
- wording, workflow friction, and policy correctness are ignored
- business issues are found but never routed back into change control
