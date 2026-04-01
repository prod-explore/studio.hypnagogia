const fs = require('fs');
const path = require('path');
const sendMail = require('../utils/mailer');

const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const templates = {
  'StudioClient.html': fs.readFileSync(path.join(__dirname, '../utils/mailTemplates', 'StudioClient.html'), 'utf-8'),
  'StudioBooked.html': fs.readFileSync(path.join(__dirname, '../utils/mailTemplates', 'StudioBooked.html'), 'utf-8')
};

function validateStudioForm(data) {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push({ field: 'name', message: 'Imię jest wymagane' });
  } else if (data.name.length > 30) {
    errors.push({ field: 'name', message: 'Imię może mieć max 30 znaków' });
  }

  if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
    errors.push({ field: 'email', message: 'Email jest wymagany' });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push({ field: 'email', message: 'Niepoprawny format email' });
    } else if (data.email.length > 50) {
      errors.push({ field: 'email', message: 'Email może mieć max 50 znaków' });
    }
  }

  const allowedTypes = ['stationary', 'mobile'];
  if (!data.studioType || !allowedTypes.includes(data.studioType)) {
    errors.push({ field: 'studioType', message: 'Niepoprawny typ studia' });
  }

  if (!data.date || typeof data.date !== 'string') {
    errors.push({ field: 'date', message: 'Data jest wymagana' });
  } else {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90);

    const dateValue = new Date(data.date);
    if (isNaN(dateValue.getTime())) {
      errors.push({ field: 'date', message: 'Niepoprawny format daty' });
    } else if (dateValue < today) {
      errors.push({ field: 'date', message: 'Data nie może być w przeszłości' });
    } else if (dateValue > maxDate) {
      errors.push({ field: 'date', message: 'Data nie może być dalej niż 90 dni' });
    }
  }

  if (!data.startHour || typeof data.startHour !== 'string') {
    errors.push({ field: 'startHour', message: 'Godzina rozpoczęcia jest wymagana' });
  } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.startHour)) {
    errors.push({ field: 'startHour', message: 'Niepoprawny format godziny (HH:MM)' });
  }

  if (typeof data.sessionLength !== 'number' || isNaN(data.sessionLength)) {
    errors.push({ field: 'sessionLength', message: 'Długość sesji musi być liczbą' });
  } else if (data.sessionLength <= 0 || data.sessionLength > 480) {
    errors.push({ field: 'sessionLength', message: 'Długość sesji musi być 1–480 minut' });
  }

  if (data.comment && typeof data.comment === 'string') {
    if (data.comment.length > 200) {
      errors.push({ field: 'comment', message: 'Komentarz może mieć max 200 znaków' });
    }
    if (!/^[a-zA-Z0-9\s,.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ!]*$/.test(data.comment)) {
      errors.push({ field: 'comment', message: 'Komentarz zawiera niedozwolone znaki' });
    }
  }

  return errors;
}

function fillTemplate(fileName, data) {
  let template = templates[fileName];

  if (!template) {
      console.error(`Template not found: ${fileName}`);
      throw new Error('Internal Server Error: Missing Template');
  }

  const safeData = {};
  Object.keys(data).forEach(key => {
      safeData[key] = escapeHtml(String(data[key]));
  });

  Object.keys(safeData).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, safeData[key] || '');
  });

  // Obsługa optional comment
  template = template.replace(/{{#comment}}([\s\S]*?){{\/comment}}/g, safeData.comment ? '$1' : '');
  return template;
}

// ----------------- HANDLER -----------------
async function handleStudioForm(req, res) {
  const data = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Niepoprawne dane formularza' });
  }

  const errors = validateStudioForm(data);
  if (errors.length > 0) {
    return res.status(400).json({ status: 'error', errors });
  }

  try {
    // Generate HTML using the cached, safe function
    const clientHtml = fillTemplate('StudioClient.html', data);
    const adminHtml = fillTemplate('StudioBooked.html', data);

    await Promise.all([
        sendMail(data.email, 'Potwierdzenie zgłoszenia', clientHtml)
            .then(() => console.log(`Mail do klienta wysłany: ${data.email}`)),
        sendMail(process.env.ADMIN_EMAIL, `Nowe zgłoszenie od ${data.name}`, adminHtml)
            .then(() => console.log(`Mail do admina wysłany: ${process.env.ADMIN_EMAIL}`))
    ]);

    console.log('Formularz odebrany i przetworzony:', data);
    return res.json({ status: 'ok', message: 'Formularz odebrany i mail wysłany' });
  } catch (err) {
    console.error('Błąd przy wysyłce maila:', err.message);
    return res.status(500).json({ status: 'error', message: 'Nie udało się wysłać maila' });
  }
}

module.exports = handleStudioForm;
