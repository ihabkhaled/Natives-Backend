# Business analysis

Mock-mode success currently hides remote-mode failures. Authentication, practices, and dashboard
requests do not consistently match the backend, so users cannot rely on the deployed client.

Stakeholders are members, coaches, administrators, frontend/backend engineers, QA, support, and
release owners. Success means one reproducible contract source, zero undocumented drift, and
critical browser journeys against a real synthetic backend. The dependency is a stable current
backend API. Not fixing this risks broken sign-in and field workflows after deployment.
