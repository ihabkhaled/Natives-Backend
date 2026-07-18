# Architecture review

The change fits the modular monolith:

- Controllers remain thin and delegate once.
- Practices owns practice reminder/calendar behavior and calendar-feed persistence.
- Platform owns notification routing, preferences, outbox delivery, and failure visibility.
- Cross-module composition uses the exported `PlatformModule` services only.
- Native crypto is isolated behind a practices adapter port; raw token material never crosses into
  persistence.
- Pure RFC/quiet-hour/reminder policies live in `domain/` or `lib/`; repositories only persist.
- Multi-write token/test operations use `UnitOfWorkPort`.

Boundary changes: new practices HTTP routes and additive tables. Existing practice event names stay
stable; routes are extended, not renamed.

ADR: no standalone ADR is required because the design follows existing outbox, adapter, and
additive-migration decisions without changing the system topology.
