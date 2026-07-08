// -----------------------------------------------------------------------------
// Library encapsulation boundaries.
//
// Every third-party library is reachable only through the ONE module that owns
// it — never imported ad hoc. Swapping a vendor (logger, validator, rate
// limiter, HTTP platform, ...) then touches exactly one folder. See
// rules/12-library-wrapping-and-adapters.md.
//
// Each entry forbids importing a package everywhere EXCEPT its owning module.
// The first block is the CONCRETE policy for the vendors this workspace ships;
// the second block is the GENERIC policy for vendors a project may add later.
// -----------------------------------------------------------------------------

// Adapter scope is the stable convention for gateway modules in this repo:
// files under an `adapters/` folder, or named `*.adapter.ts`.
export const adapterScope = ["/adapters?/", "\\.adapter(?:\\.ts)?$"];

export const packageImportBoundaries = [
  // --- Shipped vendors: one owning module each -------------------------------
  {
    // Logging vendor. Everything else logs through AppLogger (@core/logger).
    forbid: ["^nestjs-pino$", "^pino$", "^pino-http$", "^pino-pretty$"],
    allowIn: ["/core/logger/"],
    message:
      "Import the logging vendor only inside src/core/logger — use AppLogger from @core/logger.",
  },
  {
    // Validation vendor. DTOs/config import the @core/validation re-exports.
    forbid: ["^class-validator$", "^class-transformer$"],
    allowIn: ["/core/validation/"],
    message:
      "Import the validation vendor only inside src/core/validation — use the @core/validation re-exports.",
  },
  {
    // OpenAPI decorator vendor. Bootstrap owns document setup.
    forbid: ["^@nestjs/swagger$"],
    allowIn: ["/core/openapi/", "/bootstrap/"],
    message:
      "Import @nestjs/swagger only in src/core/openapi (decorators) or src/bootstrap (document setup) — use @core/openapi.",
  },
  {
    // Rate-limiting vendor.
    forbid: ["^@nestjs/throttler$"],
    allowIn: ["/core/rate-limit/"],
    message:
      "Import the rate-limit vendor only inside src/core/rate-limit — import RateLimitModule instead.",
  },
  {
    // Configuration vendor. Consumers inject the typed AppConfigService.
    forbid: ["^@nestjs/config$"],
    allowIn: ["/config/"],
    message:
      "Import @nestjs/config only inside src/config — inject AppConfigService from @config/app-config.service.",
  },
  {
    // HTTP platform vendor (Fastify + its plugins + the Nest platform binding).
    forbid: ["^fastify$", "^@fastify/", "^@nestjs/platform-"],
    allowIn: ["/bootstrap/"],
    message:
      "The HTTP platform vendor lives only in src/bootstrap — cross-cutting code uses the structural types in @core/http.",
  },

  // --- Generic policy for vendors a project adds later -----------------------
  {
    forbid: ["^axios$", "^got$", "^undici$", "^node-fetch$"],
    allowIn: ["/http/", ...adapterScope],
    message: "Import HTTP clients only through a typed HTTP adapter.",
  },
  {
    forbid: ["^winston$", "^bunyan$"],
    allowIn: ["/core/logger/", ...adapterScope],
    message:
      "Alternative logging vendors also belong inside the logger module.",
  },
  {
    forbid: ["^typeorm$", "^@prisma/client$", "^mongoose$", "^sequelize$"],
    allowIn: [
      "/infrastructure/",
      "/database/",
      "/repositories?/",
      ...adapterScope,
    ],
    message: "Import ORM/database clients only in the persistence layer.",
  },
  {
    forbid: ["^amqplib$", "^kafkajs$", "^bullmq$", "^ioredis$"],
    allowIn: ["/messaging/", "/queue/", "/cache/", ...adapterScope],
    message: "Import brokers/queues/cache clients only through their adapter.",
  },
];
