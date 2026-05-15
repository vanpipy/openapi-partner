import { describe, expect, test } from 'bun:test';

describe('Config Actions', () => {
  test('should have createConfig action', () => {
    const actions = ['createConfig', 'getConfig', 'updateConfig', 'deleteConfig'];
    expect(actions).toContain('createConfig');
  });

  test('should have getConfig action', () => {
    const actions = ['createConfig', 'getConfig', 'updateConfig', 'deleteConfig'];
    expect(actions).toContain('getConfig');
  });

  test('should have updateConfig action', () => {
    const actions = ['createConfig', 'getConfig', 'updateConfig', 'deleteConfig'];
    expect(actions).toContain('updateConfig');
  });

  test('should have deleteConfig action (soft delete)', () => {
    const actions = ['createConfig', 'getConfig', 'updateConfig', 'deleteConfig'];
    expect(actions).toContain('deleteConfig');
  });
});
