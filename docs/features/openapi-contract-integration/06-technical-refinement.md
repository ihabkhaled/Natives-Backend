# Technical refinement

Chosen approach: create the Swagger document through one backend factory with a stable
operation-ID policy; normalize keys before serializing; write `contracts/openapi.json` and a SHA-256
sidecar through an explicit command; provide a check mode that writes nothing. The frontend
generation command consumes that exact artifact and outputs infrastructure-owned TypeScript.

Runtime Zod schemas remain because generated types cannot validate hostile responses. Handwritten
duplicate DTO types, runtime fetching of Swagger, and a shared cross-repository package were
rejected: they preserve drift, add deployment coupling, or weaken trust-boundary validation.
