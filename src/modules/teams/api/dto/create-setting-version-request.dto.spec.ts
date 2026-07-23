import { describe, expect, it } from 'vitest';

import { SETTING_VALUE_VALIDATORS } from '../../domain/setting-value.policy';
import { SETTING_KEY_VALUES } from '../../model/teams.enums';
import {
  CREATE_SETTING_VERSION_BODY_SCHEMA,
  CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING,
  CREATE_SETTING_VERSION_REQUEST_DTOS,
} from './create-setting-version-request.dto';
import { SETTING_VALUE_DTOS } from './setting-values';

/**
 * Backend↔domain drift guard: every `SettingKey` must have a policy validator,
 * a value DTO, a request DTO and a discriminator mapping. Adding a 9th key
 * without completing the whole set fails here (and at compile time via the
 * `Record<SettingKey, ...>` registries).
 */
describe('create-setting-version request contract', () => {
  it('ships one value DTO and one request DTO per setting key', () => {
    expect(SETTING_VALUE_DTOS).toHaveLength(SETTING_KEY_VALUES.length);
    expect(CREATE_SETTING_VERSION_REQUEST_DTOS).toHaveLength(
      SETTING_KEY_VALUES.length,
    );
  });

  it('registers a domain validator for every setting key', () => {
    for (const key of SETTING_KEY_VALUES) {
      expect(typeof SETTING_VALUE_VALIDATORS[key]).toBe('function');
    }
  });

  it('maps every setting key in the discriminator', () => {
    const mappedKeys = Object.keys(
      CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING,
    );
    expect(mappedKeys.toSorted()).toEqual([...SETTING_KEY_VALUES].toSorted());
    const refs = Object.values(CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING);
    expect(new Set(refs).size).toBe(SETTING_KEY_VALUES.length);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\/schemas\//u);
    }
  });

  it('publishes the discriminated oneOf on the whole request body', () => {
    expect(CREATE_SETTING_VERSION_BODY_SCHEMA.discriminator.propertyName).toBe(
      'settingKey',
    );
    expect(CREATE_SETTING_VERSION_BODY_SCHEMA.oneOf).toHaveLength(
      SETTING_KEY_VALUES.length,
    );
    const oneOfRefs = CREATE_SETTING_VERSION_BODY_SCHEMA.oneOf.map(
      entry => entry.$ref,
    );
    expect(oneOfRefs.toSorted()).toEqual(
      Object.values(CREATE_SETTING_VERSION_DISCRIMINATOR_MAPPING).toSorted(),
    );
  });
});
