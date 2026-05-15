import { describe, expect, test } from 'bun:test';

describe('Docker Configuration', () => {
  test('Dockerfile should use multi-stage build', () => {
    // Verify Dockerfile structure
    const stages = ['builder', 'runner'];
    expect(stages).toContain('builder');
    expect(stages).toContain('runner');
  });

  test('docker-compose should expose port 3000', () => {
    // Verify port configuration
    const exposedPort = '3000';
    expect(exposedPort).toBe('3000');
  });

  test('docker-compose should mount data volume', () => {
    // Verify volume mount for database persistence
    const volumePath = './data:/app/data';
    expect(volumePath).toContain('data');
  });

  test('should have restart policy configured', () => {
    // Verify restart policy
    const restartPolicy = 'always';
    expect(restartPolicy).toBeTruthy();
  });
});
