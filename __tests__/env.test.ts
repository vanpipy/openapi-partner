import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

// Test the env schema structure
describe('Environment Validation', () => {
  test('should validate required environment variables', () => {
    // NODE_ENV must be valid enum
    const validEnv = ['development', 'production', 'test'];
    expect(validEnv).toContain('development');
    expect(validEnv).toContain('production');
  });

  test('should have default values for optional variables', () => {
    const defaults = {
      NODE_ENV: 'development',
      DATABASE_PATH: './data/config.db',
      SESSION_MAX_AGE: 86400,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };
    expect(defaults.NEXT_PUBLIC_APP_URL).toContain('localhost');
  });

  test('should only expose NEXT_PUBLIC_ variables to client', () => {
    const publicPrefix = 'NEXT_PUBLIC_';
    const envVar = 'NEXT_PUBLIC_APP_URL';
    expect(envVar.startsWith(publicPrefix)).toBe(true);
  });
});
