# Product requirements

## Stories and acceptance criteria

- A coach can page the global and team metric catalog and see category, scale, unit, bounds, step,
  direction, guidance, applicability, tags, active state, and version.
- A permitted coach can create a team metric definition; changing a published definition creates a
  new version and never rewrites history.
- A permitted coach can create a draft template with team/season/cohort scope, evaluator roles,
  required metrics, category weights totaling 100, dates through a period, and a score version.
- Publishing locks a template version. A published template cannot be changed in place.
- A permitted coach can create bounded periods only when dates are ordered and the referenced
  season/template belongs to the requested team.
- Archiving a metric referenced by a template is rejected; unused definitions use optimistic
  concurrency.
- Unknown/not observed values are `null`; zero remains a real value. This slice stores definitions,
  not assessment values.
- Every list is bounded to 100 and ordered deterministically.
- Authentication, `AssessmentReadTeam`/`AssessmentCreate`, active team scope, season scope, and
  resource ownership are enforced.

Out of scope: player assessment drafts/publication (301), feedback/goals (302), score computation
(303), and physical measurement attempts/protocols (304). User-facing errors use stable message
keys. OpenAPI DTO decorators document every route. No notification is required for catalog edits.
