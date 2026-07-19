import type { DatabaseConfig } from '@config/config.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pgMock = vi.hoisted(() => ({
  constructor: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));

vi.mock('pg', () => ({
  Client: function MockClient(config: unknown) {
    pgMock.constructor(config);
    return {
      connect: pgMock.connect,
      query: pgMock.query,
      end: pgMock.end,
    };
  },
}));

import { ensureDatabaseExists } from './ensure-database';

const CONFIG: DatabaseConfig = {
  url: undefined,
  host: 'db.local',
  port: 6543,
  username: 'app-owner',
  password: 'not-logged',
  name: 'ultimate_natives',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

describe('ensureDatabaseExists', () => {
  beforeEach(() => {
    pgMock.connect.mockResolvedValue(undefined);
    pgMock.end.mockResolvedValue(undefined);
  });

  it('connects to postgres and does nothing when the target exists', async () => {
    pgMock.query.mockResolvedValueOnce({ rowCount: 1 });

    await expect(ensureDatabaseExists(CONFIG)).resolves.toBe(false);

    expect(pgMock.constructor).toHaveBeenCalledWith({
      host: CONFIG.host,
      port: CONFIG.port,
      user: CONFIG.username,
      password: CONFIG.password,
      database: 'postgres',
      ssl: undefined,
    });
    expect(pgMock.query).toHaveBeenCalledOnce();
    expect(pgMock.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [CONFIG.name],
    );
    expect(pgMock.end).toHaveBeenCalledOnce();
  });

  it('creates a missing strictly validated target and reports creation', async () => {
    pgMock.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: null });

    await expect(ensureDatabaseExists(CONFIG)).resolves.toBe(true);

    expect(pgMock.query).toHaveBeenNthCalledWith(
      2,
      'CREATE DATABASE "ultimate_natives"',
    );
  });

  it('derives decoded connection fields and database name from DATABASE_URL', async () => {
    pgMock.query.mockResolvedValueOnce({ rowCount: 1 });

    await ensureDatabaseExists({
      ...CONFIG,
      url: 'postgres://app%2Downer:p%40ss@db.example:7654/natives_local',
      ssl: true,
    });

    expect(pgMock.constructor).toHaveBeenCalledWith({
      host: 'db.example',
      port: 7654,
      user: 'app-owner',
      password: 'p@ss',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });
    expect(pgMock.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['natives_local'],
    );
  });

  it('uses the PostgreSQL default port and configured name for a URL without them', async () => {
    pgMock.query.mockResolvedValueOnce({ rowCount: 1 });

    await ensureDatabaseExists({
      ...CONFIG,
      url: 'postgres://app-owner@db.example',
    });

    expect(pgMock.constructor).toHaveBeenCalledWith(
      expect.objectContaining({ port: 5432 }),
    );
    expect(pgMock.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [CONFIG.name],
    );
  });

  it('rejects an unsafe database identifier before opening a connection', async () => {
    await expect(
      ensureDatabaseExists({ ...CONFIG, name: 'app"; DROP DATABASE postgres' }),
    ).rejects.toThrow('Database name is not a safe PostgreSQL identifier');

    expect(pgMock.constructor).not.toHaveBeenCalled();
  });

  it('propagates connection and create failures while still closing quietly', async () => {
    pgMock.connect.mockRejectedValueOnce(new Error('connection refused'));

    await expect(ensureDatabaseExists(CONFIG)).rejects.toThrow(
      'connection refused',
    );
    expect(pgMock.end).toHaveBeenCalledOnce();

    pgMock.connect.mockResolvedValueOnce(undefined);
    pgMock.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockRejectedValueOnce(new Error('permission denied'));
    pgMock.end.mockRejectedValueOnce(new Error('already closed'));

    await expect(ensureDatabaseExists(CONFIG)).rejects.toThrow(
      'permission denied',
    );
  });
});
