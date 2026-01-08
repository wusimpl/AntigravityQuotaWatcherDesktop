/**
 * Logger utility with file persistence for error diagnosis
 * Logs are stored in the app's user data directory
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Log levels
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Maximum log file size (5MB)
const MAX_LOG_SIZE = 5 * 1024 * 1024;
// Maximum number of log files to keep
const MAX_LOG_FILES = 3;

class Logger {
  private logDir: string = '';
  private logFile: string = '';
  private initialized = false;
  private writeQueue: string[] = [];
  private isWriting = false;

  /**
   * Initialize logger - must be called after app is ready
   */
  initialize(): void {
    if (this.initialized) return;

    try {
      this.logDir = path.join(app.getPath('userData'), 'logs');
      
      // Ensure log directory exists
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create log file with date
      const date = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `app-${date}.log`);

      this.initialized = true;
      this.rotateLogsIfNeeded();
      
      this.info('[Logger] Initialized, log file:', this.logFile);
    } catch (err) {
      console.error('[Logger] Failed to initialize:', err);
    }
  }

  /**
   * Get timestamp string
   */
  private getTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, args: unknown[]): string {
    const timestamp = this.getTimestamp();
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * Write to log file asynchronously
   */
  private async writeToFile(formattedMessage: string): Promise<void> {
    if (!this.initialized) return;

    this.writeQueue.push(formattedMessage + '\n');
    
    if (this.isWriting) return;
    
    this.isWriting = true;
    
    while (this.writeQueue.length > 0) {
      const messages = this.writeQueue.splice(0, 100).join('');
      try {
        fs.appendFileSync(this.logFile, messages, 'utf-8');
      } catch (err) {
        console.error('[Logger] Failed to write to log file:', err);
      }
    }
    
    this.isWriting = false;
  }

  /**
   * Rotate logs if current file is too large
   */
  private rotateLogsIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const stats = fs.statSync(this.logFile);
      if (stats.size < MAX_LOG_SIZE) return;

      // Rotate: rename current file with timestamp
      const timestamp = Date.now();
      const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
      fs.renameSync(this.logFile, rotatedFile);

      // Clean up old log files
      this.cleanupOldLogs();
    } catch (err) {
      console.error('[Logger] Failed to rotate logs:', err);
    }
  }

  /**
   * Remove old log files exceeding MAX_LOG_FILES
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only MAX_LOG_FILES most recent files
      files.slice(MAX_LOG_FILES).forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch {
          // Ignore deletion errors
        }
      });
    } catch (err) {
      console.error('[Logger] Failed to cleanup old logs:', err);
    }
  }

  /**
   * Log debug message
   */
  debug(...args: unknown[]): void {
    const formatted = this.formatMessage('DEBUG', args);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  /**
   * Log info message
   */
  log(...args: unknown[]): void {
    const formatted = this.formatMessage('INFO', args);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  /**
   * Alias for log
   */
  info(...args: unknown[]): void {
    this.log(...args);
  }

  /**
   * Log warning message
   */
  warn(...args: unknown[]): void {
    const formatted = this.formatMessage('WARN', args);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  /**
   * Log error message
   */
  error(...args: unknown[]): void {
    const formatted = this.formatMessage('ERROR', args);
    console.error(formatted);
    this.writeToFile(formatted);
  }

  /**
   * Get log directory path
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get current log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Get all log files
   */
  getLogFiles(): string[] {
    if (!this.initialized || !fs.existsSync(this.logDir)) {
      return [];
    }

    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .map(f => path.join(this.logDir, f))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  /**
   * Read all logs content (for export)
   */
  readAllLogs(): string {
    const files = this.getLogFiles();
    let content = '';

    for (const file of files) {
      try {
        const fileContent = fs.readFileSync(file, 'utf-8');
        content += `\n========== ${path.basename(file)} ==========\n`;
        content += fileContent;
      } catch {
        // Skip unreadable files
      }
    }

    return content || 'No logs available';
  }

  /**
   * Export logs to specified path
   */
  exportLogs(targetPath: string): boolean {
    try {
      const content = this.readAllLogs();
      fs.writeFileSync(targetPath, content, 'utf-8');
      this.info('[Logger] Logs exported to:', targetPath);
      return true;
    } catch (err) {
      this.error('[Logger] Failed to export logs:', err);
      return false;
    }
  }
}

// Singleton instance
export const logger = new Logger();
