# HYPNAGOGIA — Premium Beat Store

A high-performance, containerized digital beat leasing platform and portfolio system for Studio Hypnagogia. The application leverages a unified backend architecture serving both the core business frontend and specialized operational endpoints, bypassing traditional monolithic CMS solutions in favor of a lean, API-driven design.

## System Architecture

The project operates on a single-tier Node.js/Express architecture serving a highly optimized vanilla front-end. It emphasizes structural simplicity, extreme performance, and reliable integration with critical third-party services (Stripe, Mailgun, YouTube).

### Core Components

- **Express Gateway (`server.js`)**: The root application server. Manages global rate-limiting (via `express-rate-limit`), security headers (`helmet`), static asset delivery (`public/`), and API routing.
- **Dynamic Content Engine**: Periodically fetches and caches the production catalog from the YouTube v3 API via a scheduled cron job (running every 15 minutes), ensuring real-time sync with content uploads without front-end loading penalties.
- **Payment & Delivery Pipeline**: Secure, webhook-driven checkout flow using Stripe. Upon successful payment verification, the system triggers `PDFKit` for dynamic legal license generation and `Resend` for automated asset and document delivery.
- **Client Interface (`public/`)**: A zero-dependency Vanilla JS/CSS Single Page Application (SPA). Features a custom DOM-optimized audio scrubbing UI that interfaces directly with the YouTube iframe API, preventing heavy re-renders during progress state changes.

## Tech Stack

- **Runtime Environment**: Node.js
- **Framework**: Express.js
- **Security & Validation**: Helmet, Joi, Express-Rate-Limit
- **Billing & Payments**: Stripe API
- **Communications**: Resend API
- **Document Generation**: PDFKit
- **Deployment**: Docker & Docker Compose

## API Structure

- `GET /api/beats` — Serves the internally cached JSON catalog of beats synchronized from YouTube.
- `POST /api/beats/checkout` — Initializes a Stripe checkout session based on selected beat and license type.
- `POST /api/beats/webhook` — Listens for Stripe fulfillment events to execute the secure asset delivery sequence.
- `POST /api/beats/validate-promo` — Validates internal promotional codes.
- `POST /api/studio` & `POST /api/mixmaster` — Handles specialized intake forms for physical studio bookings and mix/master services.

## Development & Deployment

The platform is fully containerized for seamless and identical deployments across development and production environments.

**Local Execution:**
```bash
npm install
npm run dev
```

**Docker Production Deployment:**
```bash
docker-compose up -d --build
```

### Environment Configuration
The system requires a `.env` file containing secrets for Stripe, Resend, YouTube API, and contact endpoints. This ensures secure token separation from the codebase.
