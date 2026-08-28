// Shared foundation.
// Purpose: generate and sign JWT session tokens.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const generateToken = (userId, payload = {}) => {
    return jwt.sign({ id: userId, ...payload }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

export default generateToken;