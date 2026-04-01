require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const handleStudioForm = require('./functions/StudioForm');
const handleMixMasterForm = require('./functions/MixMasterForm');
const { handleBeatsCheckout, handleBeatsWebhook, validatePromo } = require('./functions/BeatsPurchase');

const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const updateBeats = require("./functions/updateBeats");

const app = express();
app.set('trust proxy', 1);
app.disable("x-powered-by");
const PORT = 3000;

// Rate limiter – max 20 requestów na minutę
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

// ============================================
// STRIPE WEBHOOK - MUST BE BEFORE express.json()
// ============================================
app.post('/api/beats/webhook',
    express.raw({ type: 'application/json' }),
    handleBeatsWebhook
);

// Middleware
app.use(helmet());
app.use(cors({
    origin: ["https://studio.hypnagogia.pl"], // dopuszczalne domeny
    methods: ["POST", "GET"],
}));
app.use(express.json({ limit: '200kb' })); // ograniczenie payloadu
app.use(express.urlencoded({ extended: true }));
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            status: "error",
            message: "Nieprawidłowy format danych."
        });
    }
    next(err);
});
app.use(limiter);

// Endpoint do zgłoszeń do studia
app.post('/api/studio', async (req, res) => {
    try {
        await handleStudioForm(req, res);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Wystąpił nieoczekiwany błąd serwera.',
        });
    }
});

// Endpoint do zgłoszeń Mix/Master
app.post('/api/mixmaster', async (req, res) => {
    try {
        await handleMixMasterForm(req, res);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Wystąpił nieoczekiwany błąd serwera.',
        });
    }
});

// ============================================
// BEATS API
// ============================================

app.get("/api/beats", (req, res) => {
    try {
        const beats = fs.readFileSync(path.join(__dirname, "data/beats.json"), "utf8");
        res.json(JSON.parse(beats));
    } catch (err) {
        res.status(500).json({ status: "error", message: "Błąd wczytywania beatów" });
    }
});

// Create checkout session for beat purchase
app.post('/api/beats/checkout', async (req, res) => {
    try {
        await handleBeatsCheckout(req, res);
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Wystąpił nieoczekiwany błąd serwera.',
        });
    }
});

// Validate promo code
app.post('/api/beats/validate-promo', async (req, res) => {
    try {
        await validatePromo(req, res);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Wystąpił nieoczekiwany błąd serwera.',
        });
    }
});

// Obsługa nieistniejących endpointów
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Endpoint nie istnieje.' });
});

app.use((err, req, res, next) => {
    console.error("Global Server Error:", err);
    res.status(500).json({
        status: 'error',
        message: 'Wystąpił nieoczekiwany błąd serwera.',
    });
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Backend działa na porcie ${PORT}`);
});

// Cron — codziennie o 18:00
cron.schedule("0 18 * * *", () => {
    console.log("CRON: aktualizacja listy beatów...");
    updateBeats();
});

// Jednorazowe pobranie przy starcie
updateBeats();
