# Impact analysis

Affected systems are backend bootstrap/tooling/CI, frontend HTTP/contracts/gateways/tests, release
evidence, and support documentation. Existing clients may break if active payloads are replaced
without compatibility, so contract classification and coordinated rollout are required. No data
migration is planned. Monitoring should surface schema-mismatch counts and auth/practice endpoint
failures. Privacy impact is reduced because generated artifacts contain schemas only and synthetic
examples.
