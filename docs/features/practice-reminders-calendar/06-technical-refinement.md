# Technical refinement

## Chosen approach

- Reuse the existing TypeORM migration runner, `UnitOfWorkPort`, transactional outbox, notification
  inbox/dedupe key, preferences, and outbox admin visibility.
- Store random opaque feed credentials as SHA-256 hashes. Return the raw value only once.
- Register the public calendar-feed route with the centralized HTTP URL sanitizer so pino records
  `/calendar/feeds/[Redacted].ics` and never the bearer credential.
- Build ICS with native TypeScript/Node primitives behind an app-owned token adapter and pure
  formatter; add no dependency.
- Query only visible, published/rescheduled/cancelled sessions in bounded windows.
- Model quiet hours as one owner record per user and resolve local time with the platform ICU
  timezone database.
- Enqueue admin test/reminder events through `RecordDomainEventService`; never call the notification
  sender inline.

## Alternatives

- Signed stateless JWT feed tokens: rejected because revocation still needs persistence and JWT
  would add another credential format.
- Per-session ICS download only: rejected because it does not provide subscription updates.
- Calendar provider SDK: rejected; RFC 5545 text is small, deterministic, and dependency-free.
- New queue/vendor: rejected; the existing durable outbox already owns retries and dead letters.

Trade-off: opaque feed tokens require one indexed database lookup per calendar refresh, accepted for
revocation and scope safety.
