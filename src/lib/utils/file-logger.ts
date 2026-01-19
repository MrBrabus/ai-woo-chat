/**
 * File-based logging utility
 * 
 * Writes structured logs to files for debugging and monitoring
 * Logs are written to logs/ directory with daily rotation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { LogEntry } from './logger';

const LOGS_DIR = join(process.cwd(), 'logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_LOG_FILES = 7; // Keep 7 days of logs

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get log file path for today
 */
function getLogFilePath(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(LOGS_DIR, `app-${today}.log`);
}

/**
 * Rotate old log files (keep only last N days)
 */
async function rotateLogFiles(): Promise<void> {
  try {
    const files = await fs.readdir(LOGS_DIR);
    const logFiles = files
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: join(LOGS_DIR, f),
      }));

    // Sort by date (newest first)
    logFiles.sort((a, b) => b.name.localeCompare(a.name));

    // Delete files older than MAX_LOG_FILES days
    for (let i = MAX_LOG_FILES; i < logFiles.length; i++) {
      try {
        await fs.unlink(logFiles[i].path);
      } catch (err) {
        // Ignore errors when deleting old logs
        console.error('Failed to delete old log file:', logFiles[i].path, err);
      }
    }
  } catch (err) {
    // Ignore rotation errors
    console.error('Failed to rotate log files:', err);
  }
}

/**
 * Write log entry to file
 */
export async function writeLogToFile(entry: LogEntry): Promise<void> {
  try {
    await ensureLogsDir();
    
    const logLine = JSON.stringify(entry) + '\n';
    const logFile = getLogFilePath();
    
    // Append to log file
    await fs.appendFile(logFile, logLine, 'utf-8');
    
    // Check file size and rotate if needed
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        // File is too large, create new file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = join(LOGS_DIR, `app-${timestamp}.log`);
        await fs.rename(logFile, rotatedFile);
      }
    } catch {
      // Ignore stat errors
    }
    
    // Rotate old files (async, don't wait)
    rotateLogFiles().catch(() => {
      // Ignore rotation errors
    });
  } catch (error) {
    // Fallback to console if file writing fails
    console.error('Failed to write log to file:', error);
    console.error('Log entry:', entry);
  }
}

/**
 * Read recent log entries
 */
export async function readRecentLogs(
  limit: number = 100,
  level?: 'info' | 'warn' | 'error' | 'debug'
): Promise<LogEntry[]> {
  try {
    await ensureLogsDir();
    
    const logFile = getLogFilePath();
    
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // Parse JSON lines and filter by level if specified
      const entries: LogEntry[] = lines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is LogEntry => {
          if (!entry) return false;
          if (level && entry.level !== level) return false;
          return true;
        })
        .reverse() // Newest first
        .slice(0, limit);
      
      return entries;
    } catch {
      // Log file doesn't exist yet
      return [];
    }
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
}

/**
 * Clear old log files (keep only today's)
 */
export async function clearOldLogs(): Promise<void> {
  try {
    await ensureLogsDir();
    
    const files = await fs.readdir(LOGS_DIR);
    const today = new Date().toISOString().split('T')[0];
    const todayFile = `app-${today}.log`;
    
    for (const file of files) {
      if (file.startsWith('app-') && file.endsWith('.log') && file !== todayFile) {
        try {
          await fs.unlink(join(LOGS_DIR, file));
        } catch {
          // Ignore deletion errors
        }
      }
    }
  } catch (error) {
    console.error('Failed to clear old logs:', error);
  }
}
