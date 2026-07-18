# 08 Architecture review

The change fits the existing layered Identity module:

`AuthController/PublicInvitationController -> application use case -> identity repository`.

Controllers bind DTO/decorator input and delegate once. Application operations own authorization
decisions and security-event coordination. Repositories contain parameterized, user-scoped, bounded
SQL only. JWT remains behind `AuthTokenPort`; the vendor adapter only validates the app-owned optional
session claim. DTOs and model contracts retain declaration ownership.

The public contract adds routes and response schemas; the root OpenAPI work will regenerate the
canonical artifact after this slice. There is no topology, database, adapter, or cross-module boundary
change and no ADR is required.
