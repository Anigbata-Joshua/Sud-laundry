// Shared foundation.
// Purpose: generate and sign JWT session tokens.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

export default generateToken;