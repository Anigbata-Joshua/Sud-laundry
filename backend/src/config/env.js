// Shared foundation.
// Purpose: load and export environment variables in one place.

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (../../.env)
dotenv.config({ path: join(__dirname, '../../.env') });

export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: parseInt(process.env.PORT || '5000', 10),

    MONGO_URI: process.env.MONGO_URI || 'mongodb://jasminechinasanweke_db_user:jasmine2020@ac-25zs6bm-shard-00-00.omqr22g.mongodb.net:27017,ac-25zs6bm-shard-00-01.omqr22g.mongodb.net:27017,ac-25zs6bm-shard-00-02.omqr22g.mongodb.net:27017/?ssl=true&replicaSet=atlas-10nvb9-shard-0&authSource=admin&appName=Cluster0',
    frontendUri: process.env.FRONTEND_URI || 'http://localhost:5173',

    corsOrigins: (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),

    jwtSecret: process.env.JWT_SECRET || 'thisismykeys',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // Cloudinary
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
    cloudinaryName: process.env.CLOUDINARY_NAME || '',

    // Email (SMTP)
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
};



