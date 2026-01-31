/**
 * Centralized logging utility for the application.
 * Automatically disables debug logs in production builds.
 * 
 * @module logger
 */

const isDev = import.meta.env.DEV;

/**
 * Logger utility that conditionally logs based on environment.
 * In production, only errors are logged to console.
 */
export const logger = {
  /**
   * Log debug information (only in development)
   * @param args - Arguments to log
   */
  log: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warnings (only in development)
   * @param args - Arguments to log
   */
  warn: (...args: unknown[]): void => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log errors (always logged, even in production)
   * @param args - Arguments to log
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },

  /**
   * Log info messages (only in development)
   * @param args - Arguments to log
   */
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log debug messages with a label (only in development)
   * @param label - Label for the log message
   * @param data - Data to log
   */
  debug: (label: string, data?: unknown): void => {
    if (isDev) {
      console.log(`[DEBUG] ${label}`, data ?? '');
    }
  },
};
