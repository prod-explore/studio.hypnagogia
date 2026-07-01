require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Import backend functions (from existing backend/)
const { handleBeatsCheckout, handleBeatsWebhook, validatePromo } = require('./backend/functions/BeatsPurchase');
const updateBeats = require('./backend/functions/updateBeats');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

// Rate limiter
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
});

// ============================================
// STRIPE WEBHOOK — MUST BE BEFORE express.json()
// ============================================
app.post('/api/beats/webhook',
    express.raw({ type: 'application/json' }),
    handleBeatsWebhook
);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // allow YouTube embeds etc.
}));
app.use(cors({
    origin: [
        'https://studio.hypnagogia.pl',
        'http://localhost:3000',
    ],
    methods: ['POST', 'GET'],
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// ============================================
// STATIC FILES — serve public/ folder
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// BEATS API
// ============================================
app.get('/api/beats', (req, res) => {
    try {
        const beatsPath = path.join(__dirname, 'backend/data/beats.json');
        const beats = fs.readFileSync(beatsPath, 'utf8');
        res.json(JSON.parse(beats));
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Błąd wczytywania beatów' });
    }
});

// Create checkout session
app.post('/api/beats/checkout', async (req, res) => {
    try {
        await handleBeatsCheckout(req, res);
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ status: 'error', message: 'Wystąpił błąd serwera.' });
    }
});

// Validate promo code
app.post('/api/beats/validate-promo', async (req, res) => {
    try {
        await validatePromo(req, res);
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Wystąpił błąd serwera.' });
    }
});

// ============================================
// FALLBACK — SPA-style: serve index.html for all other routes
// ============================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 for API routes
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Endpoint nie istnieje.' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ status: 'error', message: 'Wystąpił nieoczekiwany błąd serwera.' });
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
    console.log(`\n  ⚡ HYPNAGOGIA running → http://localhost:${PORT}\n`);
});

// Cron — update beats every 15 minutes
cron.schedule('*/15 * * * *', () => {
    console.log('CRON: aktualizacja listy beatów...');
    updateBeats();
});

// Initial beat fetch on startup
updateBeats();
