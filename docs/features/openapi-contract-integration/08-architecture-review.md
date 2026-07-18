# Architecture review

The backend bootstrap layer owns Swagger document construction; tooling owns normalization and disk
artifacts; controllers remain declarative and thin. The frontend packages layer owns generated
transport contracts, while modules keep gateway/schema/service/hook/component boundaries.

Data flow: Nest decorators and DTOs -> deterministic OpenAPI JSON -> checksum -> generated frontend
types -> HTTP owner -> module runtime schema -> view model. No database ownership changes occur.
ADR required: yes, for canonical artifact ownership and cross-repository compatibility workflow.
