// Shared foundation.
// Purpose: rate limiting for auth and general API routes.

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
const keyByUserOrIp = (req) => req.user?.id ?? req.ip
export const authLimiter = rateLimit({
    windowMs: env.rateLimit,
    max: env.rateLimitMax,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: env.rateLimit,
  max: env.generalRateLimitMax,
  keyGenerator: keyByUserOrIp,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})
