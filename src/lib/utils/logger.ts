/**
 * Structured logging utility
 * 
 * Provides JSON-structured logs with correlation IDs for observability
 * Also writes logs to files for debugging
 */

import { randomUUID } from 'crypto';
import { writeLogToFile } from './file-logger';

export interface LogContext {
  request_id?: string;
  site_id?: string;
  conversation_id?: string;
  visitor_id?: string;
  tenant_id?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Generate a correlation/request ID
 */
export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

/**
 * Create a logger with context
 */
export function createLogger(context: LogContext = {}) {
  const log = async (level: LogEntry['level'], message: string, additionalContext: LogContext = {}) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...context, ...additionalContext },
    };

    // Output as JSON for structured logging (console)
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      JSON.stringify(entry)
    );

    // Also write to file (async, don't wait)
    writeLogToFile(entry).catch(() => {
      // Ignore file write errors, console logging is sufficient fallback
    });
  };

  return {
    info: (message: string, context?: LogContext) => {
      log('info', message, context).catch(() => {});
    },
    warn: (message: string, context?: LogContext) => {
      log('warn', message, context).catch(() => {});
    },
    error: (message: string, error?: Error, context?: LogContext) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        context: { ...context, ...context },
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
      };
      console.error(JSON.stringify(entry));
      // Also write to file
      writeLogToFile(entry).catch(() => {
        // Ignore file write errors
      });
    },
    debug: (message: string, context?: LogContext) => {
      log('debug', message, context).catch(() => {});
    },
  };
}

/**
 * Log OpenAI failure spike
 */
export function logOpenAIFailure(
  logger: ReturnType<typeof createLogger>,
  error: Error,
  context: LogContext
) {
  logger.error('OpenAI API failure', error, {
    ...context,
    failure_type: 'openai_api',
  });
}

/**
 * Log Resend failure
 */
export function logResendFailure(
  logger: ReturnType<typeof createLogger>,
  error: Error,
  context: LogContext
) {
  logger.error('Resend API failure', error, {
    ...context,
    failure_type: 'resend_api',
  });
}

/**
 * Log WordPress API failure
 */
export function logWPAPIFailure(
  logger: ReturnType<typeof createLogger>,
  error: Error,
  context: LogContext
) {
  logger.error('WordPress API failure', error, {
    ...context,
    failure_type: 'wp_api',
  });
}
