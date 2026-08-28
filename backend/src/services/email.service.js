// Owner: Josh
// Shared foundation / shared business logic

/**
 * Mock email service to log transactional emails directly to the console.
 * This is used during development to bypass external SMTP configuration.
 */
export const sendMail = async ({ to, subject, text, html }) => {
    console.log('\n=================== MOCK EMAIL SENT ===================');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text:    ${text}`);
    if (html) {
        console.log(`HTML:    [HTML Content Hidden]`);
    }
    console.log('=======================================================\n');
    return { messageId: `mock_${Date.now()}` };
};

export default sendMail;
