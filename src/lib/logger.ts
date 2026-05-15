/**
 * Logger utility using Pino
 * Fast, professional logging for Node.js
 * Logs are saved to ./logs directory
 */

import pino from 'pino';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const logFile = join(logsDir, 'app.log');
const errorLogFile = join(logsDir, 'error.log');

// Create file transports
const fileTransport = pino.transport({
  targets: [
    // Console output (human-readable in dev, JSON in prod)
    {
      target: 'pino/file',
      level: process.env.LOG_LEVEL || 'info',
      options: { destination: 1 } // stdout
    },
    // All logs to app.log
    {
      target: 'pino/file',
      level: 'info',
      options: { destination: logFile, mkdir: true }
    },
    // Errors only to error.log
    {
      target: 'pino/file',
      level: 'error',
      options: { destination: errorLogFile, mkdir: true }
    }
  ],
  dedupe: true,
});

// Base logger configuration
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}, fileTransport);

/**
 * Create a child logger with context
 */
export function createLogger(context: string): pino.Logger {
  return baseLogger.child({ module: context });
}

// Pre-configured loggers for common modules
export const taskLogger = createLogger('TaskProcessor');
export const syncLogger = createLogger('SyncService');
export const generatorLogger = createLogger('Generator');
export const apiLogger = createLogger('API');
export const projectLogger = createLogger('ProjectActions');

export { baseLogger as logger };
export default baseLogger;
