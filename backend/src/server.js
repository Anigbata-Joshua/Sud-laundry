// Shared foundation.
// Purpose: server entry point — connects DB then starts listening.

import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 3573;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});