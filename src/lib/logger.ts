/**
 * Logger utility
 * Logs are saved to ./logs directory
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const logFile = join(logsDir, 'app.log');
const errorLogFile = join(logsDir, 'error.log');

// Custom file write function
function writeToFile(filepath: string, message: string) {
  try {
    appendFileSync(filepath, message + '\n');
  } catch {
    // Ignore file write errors
  }
}

interface LogEntry {
  time: string;
  level: string;
  message: string;
  module?: string;
  [key: string]: unknown;
}

function formatLog(level: string, message: string, context?: object): string {
  // Handle Error objects specially - their properties aren't enumerable
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
  };
  
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Error) {
        entry[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      } else {
        entry[key] = value;
      }
    }
  }
  
  return JSON.stringify(entry);
}

// Base logger interface
interface LoggerInterface {
  trace: (obj: object | string, msg?: string) => void;
  debug: (obj: object | string, msg?: string) => void;
  info: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
  error: (obj: object | string, msg?: string) => void;
  fatal: (obj: object | string, msg?: string) => void;
  child: (context: object) => LoggerInterface;
}

function createLoggerModule(): LoggerInterface {
  const write = (level: string, obj: object | string, msg?: string) => {
    const message = typeof obj === 'string' ? obj : (msg || '');
    const context = typeof obj === 'object' ? obj : {};
    
    const logLine = formatLog(level, message, context);
    
    // Console output
    if (level === 'error' || level === 'fatal') {
      console.error(logLine);
    } else if (level === 'warn') {
      console.warn(logLine);
    } else if (level === 'debug') {
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(logLine);
      }
    } else {
      console.log(logLine);
    }
    
    // File output
    writeToFile(logFile, logLine);
    if (level === 'error' || level === 'fatal') {
      writeToFile(errorLogFile, logLine);
    }
  };

  const child = (context: object): LoggerInterface => {
    return {
      trace: (obj: object | string, msg?: string) => write('trace', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      debug: (obj: object | string, msg?: string) => write('debug', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      info: (obj: object | string, msg?: string) => write('info', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      warn: (obj: object | string, msg?: string) => write('warn', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      error: (obj: object | string, msg?: string) => write('error', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      fatal: (obj: object | string, msg?: string) => write('fatal', { ...context, ...(typeof obj === 'object' ? obj : {}) }, typeof obj === 'string' ? obj : msg),
      child: (additionalContext: object) => child({ ...context, ...additionalContext }),
    };
  };

  return {
    trace: (obj: object | string, msg?: string) => write('trace', obj, msg),
    debug: (obj: object | string, msg?: string) => write('debug', obj, msg),
    info: (obj: object | string, msg?: string) => write('info', obj, msg),
    warn: (obj: object | string, msg?: string) => write('warn', obj, msg),
    error: (obj: object | string, msg?: string) => write('error', obj, msg),
    fatal: (obj: object | string, msg?: string) => write('fatal', obj, msg),
    child,
  };
}

const logger = createLoggerModule();

/**
 * Create a child logger with context
 */
export function createLogger(context: string) {
  return logger.child({ module: context });
}

// Pre-configured loggers for common modules
export const taskLogger = createLogger('TaskProcessor');
export const syncLogger = createLogger('SyncService');
export const generatorLogger = createLogger('Generator');
export const apiLogger = createLogger('API');
export const projectLogger = createLogger('ProjectActions');

export { logger };
export default logger;
