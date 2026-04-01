const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

const LICENSE_TERMS = {
    lease_basic: {
        name: 'Lease Basic',
        price: 49,
        streams: '50,000',
        sales: '2,500',
        musicVideos: '1',
        radio: false,
        stems: false,
        exclusive: false,
        terms: `
LEASE BASIC LICENSE AGREEMENT

This License Agreement ("Agreement") is made between the Producer and the Licensee identified below.

GRANT OF LICENSE:
Producer grants Licensee a non-exclusive license to use the Beat for the creation of one (1) new musical composition ("New Song").

PERMITTED USES:
• Up to 50,000 audio streams (Spotify, Apple Music, etc.)
• Up to 2,500 physical/digital sales
• 1 music video (non-monetized or monetized)
• Non-profit live performances
• Social media content

RESTRICTIONS:
• Radio broadcasting is NOT permitted
• Stems are NOT included
• Resale or transfer of this license is prohibited
• The Beat may be licensed to other artists (non-exclusive)

CREDIT REQUIREMENT:
Licensee must credit Producer in all metadata and descriptions as: "Prod. by [PRODUCER_NAME]"

OWNERSHIP:
• Producer retains full copyright and ownership of the Beat composition
• Licensee owns the Master Recording of the New Song (vocals + beat)

ROYALTIES:
• Publishing: 50% to Producer, 50% to Licensee
• No master royalty share for this license tier

DELIVERY:
Beat files will be delivered within 48 hours of purchase via email.

This license is non-transferable and may not be resold or assigned to any third party.
`
    },
    lease_premium: {
        name: 'Lease Premium',
        price: 179,
        streams: '500,000',
        sales: '10,000',
        musicVideos: '3',
        radio: true,
        stems: true,
        exclusive: false,
        terms: `
LEASE PREMIUM LICENSE AGREEMENT

This License Agreement ("Agreement") is made between the Producer and the Licensee identified below.

GRANT OF LICENSE:
Producer grants Licensee a non-exclusive license to use the Beat for the creation of one (1) new musical composition ("New Song").

PERMITTED USES:
• Up to 500,000 audio streams (Spotify, Apple Music, etc.)
• Up to 10,000 physical/digital sales
• Up to 3 music videos (monetized permitted)
• Radio broadcasting permitted
• Live performances (profit and non-profit)
• Social media content without limitations

STEMS:
Stems/trackouts available upon request at no additional cost.

RESTRICTIONS:
• Resale or transfer of this license is prohibited
• The Beat may be licensed to other artists (non-exclusive)

CREDIT REQUIREMENT:
Licensee must credit Producer in all metadata and descriptions as: "Prod. by [PRODUCER_NAME]"

OWNERSHIP:
• Producer retains full copyright and ownership of the Beat composition
• Licensee owns the Master Recording of the New Song (vocals + beat)

ROYALTIES:
• Publishing: 50% to Producer, 50% to Licensee
• Master royalties: 20% of Licensee's net revenues (if signed to label)

DELIVERY:
Beat files will be delivered within 48 hours of purchase via email.
Stems available upon request.

This license is non-transferable and may not be resold or assigned to any third party.
`
    },
    exclusive: {
        name: 'Exclusive',
        price: 888,
        streams: 'Unlimited',
        sales: 'Unlimited',
        musicVideos: 'Unlimited',
        radio: true,
        stems: true,
        exclusive: true,
        terms: `
EXCLUSIVE LICENSE AGREEMENT

This License Agreement ("Agreement") is made between the Producer and the Licensee identified below.

GRANT OF LICENSE:
Producer grants Licensee an EXCLUSIVE license to use the Beat for the creation of musical compositions.
Upon execution of this Agreement, Producer will not license this Beat to any other party.

PERMITTED USES:
• UNLIMITED audio streams
• UNLIMITED physical/digital sales
• UNLIMITED music videos
• Radio broadcasting permitted
• Television and film synchronization permitted
• Live performances without restrictions
• All commercial uses permitted

STEMS:
Full stems/trackouts included with this license.

MODIFICATIONS:
Licensee may request modifications to the Beat. Minor changes included; major revisions may incur additional fees to be agreed upon.

CREDIT REQUIREMENT:
Licensee should credit Producer in all metadata and descriptions as: "Prod. by [PRODUCER_NAME]"
Credit is appreciated but not legally required for exclusive licenses.

OWNERSHIP:
• Producer retains copyright of the original Beat composition
• Licensee receives exclusive usage rights - Beat will not be sold to others
• Licensee owns the Master Recording of any songs created with the Beat

ROYALTIES:
• Publishing: 50% to Producer, 50% to Licensee
• Master royalties: 20% of Licensee's net revenues (if signed to label)

DELIVERY:
Beat files and stems will be delivered within 48 hours of purchase via email.

This license is non-transferable without Producer's written consent.
Previous non-exclusive licenses for this Beat remain valid but no new licenses will be issued.
`
    }
};

/**
 * Generate a PDF license document
 * @param {Object} orderData - Order information
 * @returns {Promise<Buffer>} PDF buffer
 */
function generateLicensePDF(orderData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const license = LICENSE_TERMS[orderData.licenseType];
        const licenseId = `LIC-${uuidv4().substring(0, 8).toUpperCase()}`;
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('BEAT LICENSE AGREEMENT', { align: 'center' });
        doc.moveDown();

        // License ID and Date
        doc.fontSize(10).font('Helvetica')
            .text(`License ID: ${licenseId}`, { align: 'center' })
            .text(`Date: ${date}`, { align: 'center' });
        doc.moveDown();

        // Divider
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Parties
        doc.fontSize(12).font('Helvetica-Bold').text('PARTIES:');
        doc.fontSize(10).font('Helvetica')
            .text(`Producer: ${orderData.producerName}`)
            .text(`Licensee: ${orderData.customerName}`)
            .text(`Email: ${orderData.customerEmail}`);
        if (orderData.artistLink) {
            doc.text(`Artist Page: ${orderData.artistLink}`);
        }
        doc.moveDown();

        // Beat Info
        doc.fontSize(12).font('Helvetica-Bold').text('BEAT INFORMATION:');
        doc.fontSize(10).font('Helvetica')
            .text(`Beat Title: ${orderData.beatTitle}`)
            .text(`License Type: ${license.name}`)
            .text(`Price Paid: ${orderData.finalPrice} PLN`);
        if (orderData.promoCode) {
            doc.text(`Promo Code Applied: ${orderData.promoCode}`);
        }
        doc.moveDown();

        // Usage Rights Table
        doc.fontSize(12).font('Helvetica-Bold').text('USAGE RIGHTS:');
        doc.fontSize(10).font('Helvetica')
            .text(`• Streams: ${license.streams}`)
            .text(`• Sales: ${license.sales}`)
            .text(`• Music Videos: ${license.musicVideos}`)
            .text(`• Radio: ${license.radio ? 'Yes' : 'No'}`)
            .text(`• Stems: ${license.stems ? 'Yes' : 'No'}`)
            .text(`• Exclusive: ${license.exclusive ? 'Yes' : 'No'}`);
        doc.moveDown();

        // Full Terms
        doc.fontSize(12).font('Helvetica-Bold').text('FULL LICENSE TERMS:');
        doc.moveDown(0.5);

        // Replace placeholder with actual producer name
        const terms = license.terms.replace(/\[PRODUCER_NAME\]/g, orderData.producerName);
        doc.fontSize(9).font('Helvetica').text(terms.trim(), {
            align: 'left',
            lineGap: 2
        });

        doc.moveDown(2);

        // Signature area
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        doc.fontSize(10).font('Helvetica')
            .text('This is an automatically generated license. By purchasing, both parties agree to the terms above.')
            .moveDown()
            .text(`Generated: ${new Date().toISOString()}`, { align: 'right' });

        doc.end();
    });
}

module.exports = { generateLicensePDF, LICENSE_TERMS };
