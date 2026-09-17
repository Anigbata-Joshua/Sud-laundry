import logger from '../utils/logger.js';

export const sendMail = async ({ to, subject, text, html }) => {
    logger.info(`[MOCK EMAIL SENT] To: ${to} | Subject: "${subject}" | Text: ${text}`);
    return { messageId: `mock_${Date.now()}` };
};

export default sendMail;