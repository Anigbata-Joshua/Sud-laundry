// services/resendEmail.service.js
// Owner: Josh
// Real transactional email sending via Resend.

import { Resend } from 'resend';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

let resend = null;

if (env.resendApiKey) {
    resend = new Resend(env.resendApiKey);
} else {
    logger.warn('⚠️ RESEND_API_KEY is not set — email sending is disabled.');
}

const FROM_ADDRESS = `Suds Laundry <onboarding@${env.resendFromDomain}>`;

export const sendMail = async ({ to, subject, text, html }) => {
    if (!resend) {
        logger.warn(`⚠️ Email not sent (Resend not configured): "${subject}" to ${to}`);
        return { messageId: null, error: 'not_configured' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject,
            html,
            text,
        });

        if (error) {
            logger.error('⚠️ Resend API error:', { error: error.message });
            return { messageId: null, error: error.message };
        }

        logger.info(`✅ Email sent: "${subject}" to ${to} (id: ${data.id})`);
        return { messageId: data.id };
    } catch (err) {
        logger.error('❌ Failed to send email:', { error: err.message });
        return { messageId: null, error: err.message };
    }
};

export default sendMail;