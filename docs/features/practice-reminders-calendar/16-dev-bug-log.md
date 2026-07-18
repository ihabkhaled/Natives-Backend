# 16 — Development bug log

- Corrected ICS tests to unfold RFC continuation lines before UID assertions.
- Enforced CRLF with a bare-LF assertion.
- Changed generic dedupe to event identity so distinct reschedules survive.
- Added a stable reminder seed so unchanged session-version dispatch converges.
- Kept public feed failures generic to prevent token/scope probing.
- Closed a transport-log leak by registering `/calendar/feeds/:feedToken.ics`
  with the centralized request-URL sanitizer; regression coverage uses a real
  pino HTTP record.
