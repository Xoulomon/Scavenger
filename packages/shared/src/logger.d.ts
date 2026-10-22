export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: Error;
}
export declare class StructuredLogger {
    private level;
    private enableConsole;
    private logs;
    constructor(level?: LogLevel, enableConsole?: boolean);
    private shouldLog;
    private createEntry;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, error?: Error, context?: Record<string, unknown>): void;
    private formatEntry;
    getLogs(level?: LogLevel): LogEntry[];
    clearLogs(): void;
    setLevel(level: LogLevel): void;
}
export {};
//# sourceMappingURL=logger.d.ts.map