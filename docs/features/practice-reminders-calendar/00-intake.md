# UN-204 intake

- Request ID: UN-204
- Title: Practice reminders, calendar feeds, and participation notifications
- Type: high-risk backend feature, schema, API, privacy, and async-delivery change
- Source: production prompt 204
- Owners: backend practices owner, platform notifications owner, QA, security, operations
- Severity / urgency: high / release-blocking for the requested product completion
- Affected domains: practices, RSVP, attendance, notifications, outbox, RBAC, PostgreSQL
- Delivery track: standard high-risk track on `feat/ultimate-natives-completion`
- Scope: reminder policies; deduplicated practice and participation notifications; revocable
  scoped calendar feed credentials; privacy-safe RFC 5545 output; preview, test, and failure
  visibility.
- Critical-risk flags: public bearer feed, cross-team IDOR, calendar privacy, background retries,
  quiet hours, schema migration.
