# 24 — Risk, compliance, and operations

- The 1,000-recipient cap requires explicit segmentation for larger teams.
- Current delivery is in-app. Future push/email must enforce quiet hours before
  send, using urgent cancellation override only when retained by the user.
- Calendar URLs are bearer credentials and depend on private handling.
- Migration down deletes newly created credentials/settings; prefer application
  rollback or forward-fix after release.

Operations use existing metrics, retry, dead-letter replay, and failure records.
