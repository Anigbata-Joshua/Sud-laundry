// services/resendEmail.service.js
// Owner: Josh
// Real transactional email sending via Resend.

import { Resend } from 'resend';
import { env } from '../config/env.js';

let resend = null;

if (env.resendApiKey) {
    resend = new Resend(env.resendApiKey);
} else {
    console.warn('⚠️ RESEND_API_KEY is not set — email sending is disabled.');
}

const FROM_ADDRESS = `Suds Laundry <onboarding@${env.resendFromDomain}>`;

export const sendMail = async ({ to, subject, text, html }) => {
    if (!resend) {
        console.warn(`⚠️ Email not sent (Resend not configured): "${subject}" to ${to}`);
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
            console.error('⚠️ Resend API error:', error.message);
            return { messageId: null, error: error.message };
        }

        console.log(`✅ Email sent: "${subject}" to ${to} (id: ${data.id})`);
        return { messageId: data.id };
    } catch (err) {
        console.error('❌ Failed to send email:', err.message);
        return { messageId: null, error: err.message };
    }
};

export default sendMail;