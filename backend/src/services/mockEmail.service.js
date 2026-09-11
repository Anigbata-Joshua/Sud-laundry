// Owner: Josh
// Mock email service — logs transactional emails to console instead of sending.

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