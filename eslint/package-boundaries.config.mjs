// -----------------------------------------------------------------------------
// Library encapsulation boundaries (CUSTOMIZE PER PROJECT).
//
// Every third-party library that matters to product behavior must be reachable
// only through a typed, app-owned adapter — never imported ad hoc across the
// codebase. This lets you centralize configuration, hardening, and error
// handling, and swap the vendor later by touching one wrapper instead of
// hundreds of call sites. See rules/12-library-wrapping-and-adapters.md.
//
// Each entry forbids importing a package/module by path/name everywhere EXCEPT
// the directories/files allowed to own that concern (its adapter). Add one
// entry per vendor concern you want to gate. The examples below are starting
// points — adjust the `forbid` patterns to the libraries your project uses.
// -----------------------------------------------------------------------------

// Adapter scope is the stable convention for gateway modules in this repo:
// files under an `adapters/` folder, or named `*.adapter.ts`.
export const adapterScope = ['/adapters?/', '\\.adapter(?:\\.ts)?$'];

export const packageImportBoundaries = [
  {
    // Raw HTTP clients belong behind an HTTP adapter, not in business code.
    forbid: ['^axios$', '^got$', '^undici$', '^node-fetch$'],
    allowIn: ['/http/', ...adapterScope],
    message: 'Import HTTP clients only through a typed HTTP adapter.',
  },
  {
    // Loggers are wrapped so log shape, redaction, and transport stay central.
    forbid: ['^winston$', '^pino$', '^bunyan$'],
    allowIn: ['/logger/', ...adapterScope],
    message: 'Import the logger only through the logger adapter.',
  },
  {
    // ORM / database clients belong in the persistence/infrastructure layer.
    forbid: ['^typeorm$', '^@prisma/client$', '^mongoose$', '^sequelize$'],
    allowIn: ['/infrastructure/', '/database/', '/repositories?/', ...adapterScope],
    message: 'Import ORM/database clients only in the persistence layer.',
  },
  {
    // Message brokers / queues are reached through a broker adapter.
    forbid: ['^amqplib$', '^kafkajs$', '^bullmq$', '^ioredis$'],
    allowIn: ['/messaging/', '/queue/', '/cache/', ...adapterScope],
    message: 'Import brokers/queues/cache clients only through their adapter.',
  },
];
