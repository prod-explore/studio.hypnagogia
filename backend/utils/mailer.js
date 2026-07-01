const { Resend } = require('resend');

let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
} else {
    console.warn("⚠️ OSTRZEŻENIE: Brak zmiennej RESEND_API_KEY w pliku .env. Wysyłka e-maili nie będzie działać.");
}

/**
 * Send email using Resend
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
        from: `Studio Hypnagogia <${process.env.EMAIL_FROM || 'no-reply@futumore.pl'}>`,
        to: [to],
        subject,
        html,
        headers: {
            "Auto-Submitted": "auto-generated",
            "Precedence": "bulk"
        }
    };

    // Handle attachments if present
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        messageData.attachments = attachments.map(att => {
            // Resend expects { filename, content } where content is Buffer or String
            return {
                filename: att.filename,
                content: att.content
            };
        });
    }

    if (!resend) {
        throw new Error("Resend API key is missing. Email not sent.");
    }

    const { data, error } = await resend.emails.send(messageData);
    
    if (error) {
        console.error("Resend Error:", error);
        throw error;
    }
    
    return data;
}

module.exports = sendMail;
