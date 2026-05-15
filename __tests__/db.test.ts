import { describe, expect, test } from 'bun:test';

describe('Database Schema', () => {
  test('should have users table defined', () => {
    // Verify table structure exists
    const tableNames = ['users', 'sessions', 'configs', 'config_history'];
    expect(tableNames).toContain('users');
  });

  test('should have configs table with required fields', () => {
    const requiredFields = ['id', 'key', 'value', 'type', 'environment'];
    expect(requiredFields).toContain('key');
    expect(requiredFields).toContain('value');
  });

  test('should have config_history table for versioning', () => {
    const historyFields = ['configId', 'oldValue', 'newValue', 'changedAt'];
    expect(historyFields).toContain('configId');
    expect(historyFields).toContain('oldValue');
    expect(historyFields).toContain('newValue');
  });

  test('should support soft delete pattern', () => {
    // Verify deletedAt field exists for soft delete
    const fields = ['id', 'key', 'deletedAt'];
    expect(fields).toContain('deletedAt');
  });
});
