const formData = require('form-data');
const Mailgun = require('mailgun.js');

const mailgun = new Mailgun(formData);
const mgClient = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: 'https://api.eu.mailgun.net',
});

/**
 * Send email using Mailgun
 * Supports two signatures:
 * 1. sendMail(to, subject, html) - Legacy/Production style
 * 2. sendMail({ to, subject, html, attachments }) - New style (Beat Purchase)
 */
async function sendMail(arg1, arg2, arg3) {
    let to, subject, html, attachments;

    if (typeof arg1 === 'object' && arg1 !== null) {
        // Object signature: { to, subject, html, attachments }
        ({ to, subject, html, attachments } = arg1);
    } else {
        // Legacy signature: (to, subject, html)
        to = arg1;
        subject = arg2;
        html = arg3;
    }

    if (!to || !subject || !html) throw new Error("Brak wymaganych danych do wysyłki maila");

    const messageData = {
        from: `Studio Hypnagogia <no-reply@${process.env.MAILGUN_DOMAIN}>`,
        to,
        subject,
        html,
        "h:Auto-Submitted": "auto-generated",
        "h:Precedence": "bulk",
    };

    // Handle attachments if present
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        messageData.attachment = attachments.map(att => {
            // Mailgun expects { filename, data } or just data
            // BeatPurchase sends { filename, content, contentType } where content is Buffer
            return {
                filename: att.filename,
                data: att.content
            };
        });
    }

    return mgClient.messages.create(process.env.MAILGUN_DOMAIN, messageData);
}

module.exports = sendMail;
