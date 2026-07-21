import { NodeEnv } from '@shared/enums';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SEED_PERSONA_PASSWORD } from './config.constants';
import { loadSeedPersonasConfig } from './seed-personas.config';

function restorePassword(value?: string) {
  if (value === undefined) {
    delete process.env['SEED_PERSONA_PASSWORD'];
    return;
  }
  process.env['SEED_PERSONA_PASSWORD'] = value;
}

function restoreNodeEnv(value?: string) {
  if (value === undefined) {
    delete process.env['NODE_ENV'];
    return;
  }
  process.env['NODE_ENV'] = value;
}

describe('loadSeedPersonasConfig', () => {
  const original = new Map<string, string | undefined>();

  beforeEach(() => {
    original.set('SEED_PERSONA_PASSWORD', process.env['SEED_PERSONA_PASSWORD']);
    original.set('NODE_ENV', process.env['NODE_ENV']);
    delete process.env['SEED_PERSONA_PASSWORD'];
    delete process.env['NODE_ENV'];
  });

  afterEach(() => {
    restorePassword(original.get('SEED_PERSONA_PASSWORD'));
    restoreNodeEnv(original.get('NODE_ENV'));
  });

  it('falls back to the synthetic development default outside production', () => {
    process.env['NODE_ENV'] = NodeEnv.Development;

    expect(loadSeedPersonasConfig()).toEqual({
      password: DEFAULT_SEED_PERSONA_PASSWORD,
    });
  });

  it('prefers an explicitly supplied credential', () => {
    process.env['NODE_ENV'] = NodeEnv.Development;
    process.env['SEED_PERSONA_PASSWORD'] = 'explicit-persona-password';

    expect(loadSeedPersonasConfig().password).toBe('explicit-persona-password');
  });

  it('refuses the development default in production', () => {
    process.env['NODE_ENV'] = NodeEnv.Production;

    expect(() => loadSeedPersonasConfig()).toThrow(
      /SEED_PERSONA_PASSWORD must be provided in production/u,
    );
  });

  it('rejects a credential that is too short', () => {
    process.env['NODE_ENV'] = NodeEnv.Production;
    process.env['SEED_PERSONA_PASSWORD'] = 'short';

    expect(() => loadSeedPersonasConfig()).toThrow(
      /SEED_PERSONA_PASSWORD must be provided in production/u,
    );
  });

  it('rejects a credential exceeding the bcrypt byte ceiling', () => {
    process.env['NODE_ENV'] = NodeEnv.Development;
    process.env['SEED_PERSONA_PASSWORD'] = 'a'.repeat(73);

    expect(() => loadSeedPersonasConfig()).toThrow(
      /must not exceed 72 UTF-8 bytes/u,
    );
  });
});
