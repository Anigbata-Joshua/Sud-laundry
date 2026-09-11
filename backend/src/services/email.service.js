// services/email.service.js
// Owner: Josh
// Purpose: single entry point for email sending. Switches between mock
// and real (Resend) implementations based on USE_MOCK_EMAIL.

import sendMockMail from './mockEmail.service.js';
import sendResendMail from './resendEmail.service.js';
import { env } from '../config/env.js';

const sendMail = env.useMockEmail ? sendMockMail : sendResendMail;

export default sendMail;