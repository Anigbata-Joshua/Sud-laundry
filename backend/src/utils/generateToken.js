// Shared foundation.
// Purpose: generate and sign JWT session tokens, and define the cookie
// they're carried in.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const generateToken = (userId, payload = {}) => {
    return jwt.sign({ id: userId, ...payload }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

// Converts a jwt-style duration string ('1d', '15m', '7d') to milliseconds,
// so the auth cookie's maxAge always matches the token's actual expiry
// instead of being hardcoded separately and silently drifting out of sync.
const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export const getTokenMaxAgeMs = () => {
    const match = /^(\d+)\s*(s|m|h|d)$/i.exec(env.jwtExpiresIn?.trim() ?? '');
    if (match) {
        return Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
    }
    // Fallback if JWT_EXPIRES_IN is a plain number (jsonwebtoken treats it as seconds).
    const asNumber = Number(env.jwtExpiresIn);
    if (Number.isFinite(asNumber)) {
        return asNumber * 1000;
    }
    return UNIT_MS.d; // sane default: 1 day
};

// Single source of truth for the auth cookie's name and options, so
// login/register (which set it) and logout (which must clear it with the
// EXACT same options) can never drift out of sync.
export const AUTH_COOKIE_NAME = 'token';

export const getAuthCookieOptions = () => ({
    httpOnly: true, // not readable by JS — the whole point of this fix (XSS can't steal it)
    secure: env.isProduction, // HTTPS only in prod; allow http for local dev
    sameSite: env.isProduction ? 'strict' : 'lax', // blocks the cookie being sent cross-site (CSRF mitigation)
    maxAge: getTokenMaxAgeMs(),
    path: '/',
});

export default generateToken;