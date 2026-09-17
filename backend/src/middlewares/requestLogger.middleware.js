// Purpose: HTTP request logging middleware using Morgan and Winston.
import morgan from 'morgan';
import env from '../config/env.js';
import { morganStream } from '../utils/logger.js';

// Skip noisy health check queries or common asset endpoints
const skip = (req) => {
  return req.url === '/api/health' || req.url === '/favicon.ico';
};

// Morgan format token string
const format = env.isProduction
  ? ':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
  : ':method :url :status :response-time ms - :res[content-length]';

export const requestLogger = morgan(format, {
  stream: morganStream,
  skip,
});

export default requestLogger;
