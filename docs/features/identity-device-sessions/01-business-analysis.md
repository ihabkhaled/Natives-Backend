# 01 Business analysis

Users need to see and terminate authenticated devices after loss, compromise, or shared-device use.
The current client exposes these controls but the backend has only token-based current/all logout.
Invitees also need enough verified context to decide whether to set a password without creating an
account-enumeration endpoint.

Success means owned active sessions are visible, cross-user session IDs are indistinguishable from
missing IDs, revoke-others preserves the access token's current refresh session, and invitation
details require possession of a valid high-entropy token. Stakeholders are members, administrators,
support, security, and mobile/web client owners. The main dependency is the existing hashed refresh
session and invitation schema. Not delivering leaves misleading UI and weaker incident response.
