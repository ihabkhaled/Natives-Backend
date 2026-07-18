# Test strategy

| Requirement / risk                                                       | Validation                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Published/upcoming/no-response/cutoff/reschedule/cancel/venue/correction | pure policy unit matrix                                                  |
| RFC ICS, escaping, CRLF, folding, UTC                                    | formatter unit tests and structural parser assertions                    |
| Stable UID and version sequence                                          | unit tests across reschedule/cancel revisions                            |
| Token entropy/hash/revoke/expiry                                         | adapter/service/repository tests                                         |
| Feed token absent from HTTP request logs                                 | pure sanitizer matrix and real pino HTTP log capture                     |
| Feed owner/team/season scope                                             | service and HTTP negative tests                                          |
| Private data exclusion                                                   | feed test searches for notes, users, RSVP and attendance content         |
| Dedupe                                                                   | projection and persistence integration tests                             |
| Quiet hours and cancellation override                                    | timezone-frozen policy/projection tests                                  |
| Provider/outbox retry                                                    | existing worker retry/dead-letter regression plus prompt-specific route  |
| Admin preview/test authorization                                         | E2E forbidden-role and cross-team cases                                  |
| Migration                                                                | empty apply, query behavior, and reversible down in database integration |

Fixtures are synthetic. Time and IDs are injected. No external network is used. Manual validation:
import a generated feed into two representative RFC-compatible calendar clients; record as
UNVERIFIED if the current environment cannot provide them.
