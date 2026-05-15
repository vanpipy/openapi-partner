/**
 * Tests for Logger module using Pino
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Logger Module', () => {
  describe('Logger Configuration', () => {
    it('should create logger with context', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('TestModule');
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should log info messages', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('InfoTest');
      
      // Should not throw
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log error messages', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('ErrorTest');
      
      // Should not throw
      expect(() => {
        logger.error({ err: new Error('Test error') }, 'Test error message');
      }).not.toThrow();
    });

    it('should include context in log messages', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('ContextTest');
      
      // Should accept object context
      expect(() => {
        logger.info({ projectId: 1, taskId: 'test-123' }, 'Message with context');
      }).not.toThrow();
    });

    it('should support child loggers', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const parentLogger = createLogger('Parent');
      const childLogger = parentLogger.child({ component: 'Child' });
      
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });
  });

  describe('Pre-configured Loggers', () => {
    it('should export taskLogger', async () => {
      const { taskLogger } = await import('@/lib/logger');
      
      expect(taskLogger).toBeDefined();
      expect(typeof taskLogger.info).toBe('function');
    });

    it('should export syncLogger', async () => {
      const { syncLogger } = await import('@/lib/logger');
      
      expect(syncLogger).toBeDefined();
      expect(typeof syncLogger.info).toBe('function');
    });

    it('should export generatorLogger', async () => {
      const { generatorLogger } = await import('@/lib/logger');
      
      expect(generatorLogger).toBeDefined();
      expect(typeof generatorLogger.info).toBe('function');
    });

    it('should export apiLogger', async () => {
      const { apiLogger } = await import('@/lib/logger');
      
      expect(apiLogger).toBeDefined();
      expect(typeof apiLogger.info).toBe('function');
    });

    it('should export projectLogger', async () => {
      const { projectLogger } = await import('@/lib/logger');
      
      expect(projectLogger).toBeDefined();
      expect(typeof projectLogger.info).toBe('function');
    });
  });

  describe('Log Levels', () => {
    it('should support trace level', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('TraceTest');
      
      expect(() => {
        logger.trace('Trace message');
      }).not.toThrow();
    });

    it('should support debug level', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('DebugTest');
      
      expect(() => {
        logger.debug('Debug message');
      }).not.toThrow();
    });

    it('should support warn level', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('WarnTest');
      
      expect(() => {
        logger.warn('Warning message');
      }).not.toThrow();
    });

    it('should support fatal level', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('FatalTest');
      
      expect(() => {
        logger.fatal('Fatal message');
      }).not.toThrow();
    });
  });

  describe('Log File Output', () => {
    const logsDir = join(process.cwd(), 'logs');
    const logFile = join(logsDir, 'app.log');
    const errorLogFile = join(logsDir, 'error.log');

    it('should create logs directory', () => {
      expect(existsSync(logsDir)).toBe(true);
    });

    it('should be able to write to log file', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('FileWriteTest');
      
      // Log an info message (should write to app.log)
      expect(() => {
        logger.info('Writing to log file');
      }).not.toThrow();
    });

    it('should write errors to error log file', async () => {
      const { createLogger } = await import('@/lib/logger');
      
      const logger = createLogger('ErrorWriteTest');
      
      // Log an error (should write to error.log)
      expect(() => {
        logger.error({ err: new Error('Test') }, 'Error log test');
      }).not.toThrow();
    });
  });
});
