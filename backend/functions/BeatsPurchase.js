const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateLicensePDF, LICENSE_TERMS } = require('./generateLicensePDF');
const sendMail = require('../utils/mailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ORDERS_PATH = path.join(__dirname, '../data/orders.json');
const PROMO_PATH = path.join(__dirname, '../data/promoCodes.json');
const BEATS_PATH = path.join(__dirname, '../data/beats.json');

// ============================================
// HELPER FUNCTIONS
// ============================================

function loadJSON(filepath) {
    try {
        return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (err) {
        console.error(`Error loading ${filepath}:`, err.message);
        return filepath.includes('orders') ? [] : {};
    }
}

function saveJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Check if a beat has been sold exclusively
 */
function isExclusivelySold(beatId) {
    const orders = loadJSON(ORDERS_PATH);
    return orders.some(order =>
        order.beatId === beatId &&
        order.licenseType === 'exclusive' &&
        order.status === 'completed'
    );
}

/**
 * Validate and apply promo code
 */
function validatePromoCode(code) {
    if (!code) return { valid: false };

    const promoCodes = loadJSON(PROMO_PATH);
    const promo = promoCodes[code.toUpperCase()];

    if (!promo) {
        return { valid: false, error: 'Nieprawidłowy kod promocyjny' };
    }

    // Check expiration
    if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
        return { valid: false, error: 'Kod promocyjny wygasł' };
    }

    // Check max uses
    if (promo.maxUses !== null && promo.used >= promo.maxUses) {
        return { valid: false, error: 'Kod promocyjny został wykorzystany' };
    }

    return {
        valid: true,
        discount: promo.discount,
        type: promo.type,
        code: code.toUpperCase()
    };
}

/**
 * Increment promo code usage
 */
function incrementPromoUsage(code) {
    if (!code) return;

    const promoCodes = loadJSON(PROMO_PATH);
    if (promoCodes[code]) {
        promoCodes[code].used += 1;
        saveJSON(PROMO_PATH, promoCodes);
    }
}

/**
 * Calculate final price after promo
 */
function calculateFinalPrice(basePrice, promo) {
    if (!promo || !promo.valid) return basePrice;

    if (promo.type === 'percent') {
        return Math.round(basePrice * (1 - promo.discount / 100));
    } else if (promo.type === 'fixed') {
        return Math.max(0, basePrice - promo.discount);
    }
    return basePrice;
}

/**
 * Get beat info by ID
 */
function getBeatById(beatId) {
    const beats = loadJSON(BEATS_PATH);
    return beats.find(b => b.id === beatId);
}

// ============================================
// API HANDLERS
// ============================================

/**
 * POST /api/beats/validate-promo
 * Validate a promo code
 */
async function validatePromo(req, res) {
    try {
        const { code, licenseType } = req.body;

        if (!code) {
            return res.status(400).json({
                status: 'error',
                message: 'Kod promocyjny jest wymagany'
            });
        }

        const promo = validatePromoCode(code);

        if (!promo.valid) {
            return res.status(400).json({
                status: 'error',
                message: promo.error
            });
        }

        // Calculate discount preview if license type provided
        let discountPreview = null;
        if (licenseType && LICENSE_TERMS[licenseType]) {
            const basePrice = LICENSE_TERMS[licenseType].price;
            const finalPrice = calculateFinalPrice(basePrice, promo);
            discountPreview = {
                originalPrice: basePrice,
                finalPrice: finalPrice,
                saved: basePrice - finalPrice
            };
        }

        return res.json({
            status: 'success',
            discount: promo.discount,
            type: promo.type,
            preview: discountPreview
        });

    } catch (err) {
        console.error('Validate promo error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Błąd walidacji kodu'
        });
    }
}

/**
 * POST /api/beats/checkout
 * Create Stripe Checkout Session
 */
async function handleBeatsCheckout(req, res) {
    try {
        const {
            email,
            name,
            artistLink,
            beatId,
            licenseType,
            promoCode
        } = req.body;

        // Validate required fields
        if (!email || !name || !beatId || !licenseType) {
            return res.status(400).json({
                status: 'error',
                message: 'Brakuje wymaganych pól: email, name, beatId, licenseType'
            });
        }

        // Validate license type
        if (!LICENSE_TERMS[licenseType]) {
            return res.status(400).json({
                status: 'error',
                message: 'Nieprawidłowy typ licencji'
            });
        }

        // Get beat info
        const beat = getBeatById(beatId);
        if (!beat) {
            return res.status(404).json({
                status: 'error',
                message: 'Beat nie został znaleziony'
            });
        }

        // Check if beat is exclusively sold
        if (isExclusivelySold(beatId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Ten beat został już sprzedany na wyłączność'
            });
        }

        // Validate promo code
        const promo = validatePromoCode(promoCode);

        // Calculate price
        const license = LICENSE_TERMS[licenseType];
        const finalPrice = calculateFinalPrice(license.price, promo);

        // Create order ID
        const orderId = `ord_${uuidv4().substring(0, 12)}`;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'pln',
                    product_data: {
                        name: `${beat.title} - ${license.name} License`,
                        description: `Licencja ${license.name} na beat "${beat.title}"`,
                    },
                    unit_amount: finalPrice * 100, // Stripe uses cents/grosze
                },
                quantity: 1,
            }],
            metadata: {
                orderId: orderId,
                beatId: beatId,
                beatTitle: beat.title,
                licenseType: licenseType,
                customerEmail: email,
                customerName: name,
                artistLink: artistLink || '',
                promoCode: promo.valid ? promo.code : '',
                originalPrice: license.price.toString(),
                finalPrice: finalPrice.toString(),
            },
            success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: process.env.STRIPE_CANCEL_URL,
        });

        // Save pending order
        const orders = loadJSON(ORDERS_PATH);
        orders.push({
            id: orderId,
            beatId: beatId,
            beatTitle: beat.title,
            licenseType: licenseType,
            customerEmail: email,
            customerName: name,
            artistLink: artistLink || null,
            promoCode: promo.valid ? promo.code : null,
            originalPrice: license.price,
            finalPrice: finalPrice,
            stripeSessionId: session.id,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        saveJSON(ORDERS_PATH, orders);

        return res.json({
            status: 'success',
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (err) {
        console.error('Checkout error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Błąd tworzenia sesji płatności'
        });
    }
}

/**
 * POST /api/beats/webhook
 * Handle Stripe webhook events
 */
async function handleBeatsWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            await processSuccessfulPayment(session);
        } catch (err) {
            console.error('Error processing payment:', err);
            // Still return 200 to Stripe so they don't retry
        }
    }

    res.json({ received: true });
}

/**
 * Process successful payment - generate license and send emails
 */
async function processSuccessfulPayment(session) {
    const metadata = session.metadata;

    // Update order status
    const orders = loadJSON(ORDERS_PATH);
    const orderIndex = orders.findIndex(o => o.id === metadata.orderId);

    if (orderIndex !== -1) {
        orders[orderIndex].status = 'completed';
        orders[orderIndex].completedAt = new Date().toISOString();
        orders[orderIndex].stripePaymentIntent = session.payment_intent;
        saveJSON(ORDERS_PATH, orders);
    }

    // Increment promo code usage
    if (metadata.promoCode) {
        incrementPromoUsage(metadata.promoCode);
    }

    // Generate license PDF
    const orderData = {
        orderId: metadata.orderId,
        beatId: metadata.beatId,
        beatTitle: metadata.beatTitle,
        licenseType: metadata.licenseType,
        customerEmail: metadata.customerEmail,
        customerName: metadata.customerName,
        artistLink: metadata.artistLink,
        promoCode: metadata.promoCode,
        originalPrice: parseInt(metadata.originalPrice),
        finalPrice: parseInt(metadata.finalPrice),
        producerName: process.env.PRODUCER_NAME || 'HYPNAGOGIA'
    };

    const licensePDF = await generateLicensePDF(orderData);

    // Send email to customer
    await sendClientEmail(orderData, licensePDF);

    // Send notification to admin
    await sendAdminEmail(orderData);

    console.log(`✅ Order ${metadata.orderId} completed - License sent to ${metadata.customerEmail}`);
}

/**
 * Send license email to customer
 */
async function sendClientEmail(orderData, licensePDF) {
    const license = LICENSE_TERMS[orderData.licenseType];

    const html = fs.readFileSync(
        path.join(__dirname, '../utils/mailTemplates/BeatLicenseClient.html'),
        'utf8'
    )
        .replace(/{{customerName}}/g, orderData.customerName)
        .replace(/{{beatTitle}}/g, orderData.beatTitle)
        .replace(/{{licenseName}}/g, license.name)
        .replace(/{{orderId}}/g, orderData.orderId)
        .replace(/{{producerName}}/g, orderData.producerName);

    await sendMail({
        to: orderData.customerEmail,
        subject: `🎵 Twoja licencja na beat "${orderData.beatTitle}"`,
        html: html,
        attachments: [{
            filename: `License_${orderData.beatTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${orderData.orderId}.pdf`,
            content: licensePDF,
            contentType: 'application/pdf'
        }]
    });
}

/**
 * Send notification email to admin
 */
async function sendAdminEmail(orderData) {
    const license = LICENSE_TERMS[orderData.licenseType];

    const html = fs.readFileSync(
        path.join(__dirname, '../utils/mailTemplates/BeatPurchaseAdmin.html'),
        'utf8'
    )
        .replace(/{{orderId}}/g, orderData.orderId)
        .replace(/{{customerName}}/g, orderData.customerName)
        .replace(/{{customerEmail}}/g, orderData.customerEmail)
        .replace(/{{artistLink}}/g, orderData.artistLink || 'Nie podano')
        .replace(/{{beatTitle}}/g, orderData.beatTitle)
        .replace(/{{licenseName}}/g, license.name)
        .replace(/{{originalPrice}}/g, orderData.originalPrice)
        .replace(/{{finalPrice}}/g, orderData.finalPrice)
        .replace(/{{promoCode}}/g, orderData.promoCode || 'Brak')
        .replace(/{{date}}/g, new Date().toLocaleString('pl-PL'));

    await sendMail({
        to: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
        subject: `💰 Nowa sprzedaż: ${orderData.beatTitle} (${license.name})`,
        html: html
    });
}

module.exports = {
    handleBeatsCheckout,
    handleBeatsWebhook,
    validatePromo
};
