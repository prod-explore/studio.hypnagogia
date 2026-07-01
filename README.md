<div align="center">
  <h1>STUDIO HYPNAGOGIA</h1>
  <p><strong>Digital Asset & Licensing E-Commerce Platform</strong></p>

  [![Build Status](https://github.com/prod-explore/studio.hypnagogia/actions/workflows/ci.yml/badge.svg)](https://github.com/prod-explore/studio.hypnagogia/actions)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
</div>

## Architecture Overview

Hypnagogia is a single-tier Node.js application serving a heavily optimized Vanilla SPA. It drops the overhead of heavy front-end frameworks and traditional CMS setups in favor of raw DOM manipulation and a direct API-driven catalog.

The system is fully containerized (Docker) and strictly typed at the API boundary, handling high-frequency audio scrubbing, automated licensing, and secure payload delivery.

### Technical Stack
- **Backend**: Express.js (Node.js)
- **Frontend**: Vanilla JS / CSS (Zero-dependency SPA)
- **Data Source**: YouTube v3 API (Cached via 15-min Cron intervals)
- **Payments**: Stripe API (Webhook-driven fulfillment)
- **Legal/Delivery**: PDFKit (On-the-fly contracts), Resend API (Asset delivery)
- **Infrastructure**: Docker, Nginx

## Core Subsystems

**Audio & DOM Engine**  
The client implements a custom audio scrubbing UI integrated directly with the YouTube Iframe API. It relies entirely on native DOM updates, completely eliminating the reconciliation overhead associated with React/Vue during rapid playback state changes.

**Catalog Sync**  
Instead of a database, the system pulls the catalog directly from YouTube via a background CRON process. This guarantees that beats are synchronized with production uploads without inflicting any load-time penalties on the client.

**Checkout & Fulfillment Pipeline**  
1. Client selects a beat and license type.
2. Express initializes a secure Stripe Checkout session.
3. Stripe Webhooks confirm payment (`checkout.session.completed`).
4. System automatically triggers `PDFKit` to dynamically generate a customized legal leasing contract.
5. `Resend` dispatches the final payload (high-res assets + PDF contract) directly to the buyer.

## Endpoints
- `GET  /api/beats` - Returns the in-memory cached JSON catalog.
- `POST /api/beats/checkout` - Initializes Stripe session.
- `POST /api/beats/webhook` - Stripe fulfillment listener.
- `POST /api/beats/validate-promo` - Code validation.
- `POST /api/studio` | `POST /api/mixmaster` - Form ingest for physical studio bookings.

## Deployment

**Local Development**
```bash
npm install
npm run dev
```

**Production (Docker)**
```bash
docker-compose up -d --build
```
*Requires `.env` with Stripe, Resend, and YouTube API credentials.*
