"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class StructuredLogger {
    constructor(level = 'info', enableConsole = true) {
        this.logs = [];
        this.level = level;
        this.enableConsole = enableConsole;
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }
    createEntry(level, message, context, error) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error,
        };
    }
    debug(message, context) {
        if (this.shouldLog('debug')) {
            this.logs.push(this.createEntry('debug', message, context));
        }
    }
    info(message, context) {
        if (this.shouldLog('info')) {
            this.logs.push(this.createEntry('info', message, context));
        }
    }
    warn(message, context) {
        if (this.shouldLog('warn')) {
            this.logs.push(this.createEntry('warn', message, context));
            if (this.enableConsole)
                console.warn(this.formatEntry(this.logs[this.logs.length - 1]));
        }
    }
    error(message, error, context) {
        if (this.shouldLog('error')) {
            this.logs.push(this.createEntry('error', message, context, error));
            if (this.enableConsole) {
                console.error(this.formatEntry(this.logs[this.logs.length - 1]));
                if (error)
                    console.error(error);
            }
        }
    }
    formatEntry(entry) {
        const { timestamp, level, message, context } = entry;
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }
    getLogs(level) {
        if (!level)
            return this.logs;
        return this.logs.filter((log) => LOG_LEVELS[log.level] >= LOG_LEVELS[level]);
    }
    clearLogs() {
        this.logs = [];
    }
    setLevel(level) {
        this.level = level;
    }
}
exports.StructuredLogger = StructuredLogger;
//# sourceMappingURL=logger.js.map