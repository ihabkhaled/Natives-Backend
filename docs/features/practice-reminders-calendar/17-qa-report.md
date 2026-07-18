# 17 — QA report

Automated unit behavior covers token scope/revoke, ICS privacy/UID/sequence,
reminder timing, quiet hours, bounded audiences, preference/dedupe, failure
recording, venue-change events, and outbox retry.

Platform/database integration reruns are green. Dedicated HTTP E2E for the new
surfaces and the final canonical contract gate remain with the parent full gate.
No manual QA claim is made.
