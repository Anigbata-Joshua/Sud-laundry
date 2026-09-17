import winston from 'winston';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// Define custom levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

// Determine the active log level from env, default to 'info' in prod and 'debug' in dev
const level = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL.toLowerCase();
  }
  return isProduction ? 'info' : 'debug';
};

// Development format: human-readable, colorized with timestamps
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    if (stack) {
      return `[${timestamp}] ${level}: ${message}\n${stack}${metaString}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

// Production format: structured JSON with ISO timestamps and full error stacks
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transports configuration
const transports = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
    silent: isTest && !process.env.LOG_LEVEL,
  }),
];

// Create Winston logger instance
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false,
});

// Stream for morgan HTTP logging middleware integration
export const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

export default logger;
