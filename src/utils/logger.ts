// Simple structured logger
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, meta: LogContext = {}): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...this.context,
      ...meta,
    };

    const logString = JSON.stringify(logData);

    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
    }
  }

  debug(message: string, meta?: LogContext): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogContext): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: LogContext): void {
    this.log('error', message, meta);
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

export const logger = new Logger();

export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

