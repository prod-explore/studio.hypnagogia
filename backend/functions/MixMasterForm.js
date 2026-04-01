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

// Wczytanie template'ów maili
const templates = {
  'MixMasterClient.html': fs.readFileSync(path.join(__dirname, '../utils/mailTemplates', 'MixMasterClient.html'), 'utf-8'),
  'MixMasterBooked.html': fs.readFileSync(path.join(__dirname, '../utils/mailTemplates', 'MixMasterBooked.html'), 'utf-8')
};

// Walidacja danych formularza
function validateMixMasterForm(data) {
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

  if (!data.link || typeof data.link !== 'string' || data.link.trim() === '') {
    errors.push({ field: 'link', message: 'Link do plików jest wymagany' });
  } else if (!/^https?:\/\/.+/.test(data.link)) {
    errors.push({ field: 'link', message: 'Link musi być poprawnym URL' });
  } else if (data.link.length > 500) {
    errors.push({ field: 'link', message: 'Link jest za długi (max 500 znaków)' });
  }

  if (data.comment && typeof data.comment === 'string') {
    if (data.comment.length > 200) {
      errors.push({ field: 'comment', message: 'Komentarz może mieć max 200 znaków' });
    }
    if (!/^[\p{L}0-9\s.,!?'"()\/+\-–—_:@#%&]*$/u.test(data.comment)) {
      errors.push({ field: 'comment', message: 'Komentarz zawiera niedozwolone znaki' });
    }
}


  return errors;
}

// Wypełnianie template
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

  template = template.replace(/{{#comment}}([\s\S]*?){{\/comment}}/g, safeData.comment ? '$1' : '');
  return template;
}

// ----------------- HANDLER -----------------
async function handleMixMasterForm(req, res) {
  const data = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Niepoprawne dane formularza' });
  }

  const errors = validateMixMasterForm(data);
  if (errors.length > 0) {
    return res.status(400).json({ status: 'error', errors });
  }

  try {
    const clientHtml = fillTemplate('MixMasterClient.html', data);
    const adminHtml = fillTemplate('MixMasterBooked.html', data);

    await Promise.all([
      sendMail(data.email, 'Potwierdzenie zgłoszenia', clientHtml),
      sendMail(process.env.ADMIN_EMAIL, `Nowe zgłoszenie Mix/Master od ${data.name}`, adminHtml)
    ]);

    console.log('Mix/Master formularz odebrany i przetworzony:', data);
    return res.json({ status: 'ok', message: 'Formularz odebrany i mail wysłany' });
  } catch (err) {
    console.error('Błąd przy wysyłce maila:', err.message);
    return res.status(500).json({ status: 'error', message: 'Nie udało się wysłać maila' });
  }
}

module.exports = handleMixMasterForm;
