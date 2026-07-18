# Business analysis

Members currently lack one trustworthy place to receive practice changes and subscribe from their
device calendar. Coaches also lack a safe preview of who will be notified and why.

Stakeholders are members, coaches, team administrators, support, and operations. The desired state
is accurate, non-duplicated communication for publication, upcoming practices, missing RSVP,
cutoff, reschedule, cancellation, venue change, and attendance correction.

Success means one notification per recipient/event/revision, revoked feed credentials stop working,
calendar updates keep one stable event identity, quiet-hour decisions are deterministic, and no
private note or participant list enters the feed.

Assumptions:

- The existing transactional outbox remains the durable delivery owner.
- In-app delivery is the active provider; future email/push providers reuse the same port.
- `Africa/Cairo` is the default preference/feed timezone.
- Team-scoped permissions are resolved by the existing permission guard and reinforced by active
  membership checks for feed ownership.

Risk of not delivering: missed cancellations, duplicate or stale reminders, privacy leakage through
shared calendar URLs, and support teams unable to diagnose failed delivery.
