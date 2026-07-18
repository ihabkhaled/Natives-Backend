# Business analysis

Coaches currently have no canonical assessment vocabulary, so scores cannot be compared reliably
across evaluators, seasons, or later scoring-engine versions. The desired state is one documented
dictionary with explicit direction, unit, bounds, and missing-value semantics, plus reusable locked
templates and bounded evaluation periods.

Stakeholders are players, coaches, team administrators, analysts, QA, and support. Success means all
33 required audited metrics exist with stable definitions, legacy 0–5 remains representable,
missing remains `null`, published versions cannot mutate, and every team/season access is isolated.

Assumptions: the existing team/season UUID scope and RBAC permission catalog are authoritative;
cohort is a bounded label in this slice because a cohort aggregate does not yet exist. Dependency:
prompts 301–304 will reference the immutable definition/template versions created here. Without the
change, later assessments risk silent scale drift and historically invalid scoring.
