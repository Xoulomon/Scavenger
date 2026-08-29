export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StructuredLogger {
  private level: LogLevel;
  private enableConsole: boolean;
  private logs: LogEntry[] = [];

  constructor(level: LogLevel = 'info', enableConsole: boolean = true) {
    this.level = level;
    this.enableConsole = enableConsole;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private createEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.logs.push(this.createEntry('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.logs.push(this.createEntry('info', message, context));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.logs.push(this.createEntry('warn', message, context));
      if (this.enableConsole) console.warn(this.formatEntry(this.logs[this.logs.length - 1]));
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.logs.push(this.createEntry('error', message, context, error));
      if (this.enableConsole) {
        console.error(this.formatEntry(this.logs[this.logs.length - 1]));
        if (error) console.error(error);
      }
    }
  }

  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return this.logs;
    return this.logs.filter((log) => LOG_LEVELS[log.level] >= LOG_LEVELS[level]);
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}