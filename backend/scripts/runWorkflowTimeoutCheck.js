// Owner: Josh
// Purpose: One-off runner script to execute workflow timeout check manually from the terminal.

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runWorkflowTimeoutCheck } from '../src/jobs/workflowTimeout.job.js';
import logger from '../src/utils/logger.js';

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      logger.error('❌ MONGODB_URI is not defined in environment');
      process.exit(1);
    }

    logger.info('Connecting to MongoDB for workflow timeout check...');
    await mongoose.connect(process.env.MONGODB_URI);

    const summary = await runWorkflowTimeoutCheck();
    logger.info('📊 Result Summary:', summary);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Manual workflow timeout check failed:', { error: error.message });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

run();

