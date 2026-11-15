# 🎟️ EventPass — Event Ticketing Platform with Online Payments

> **"Customers pay, webhooks confirm it, and orders update automatically. Guaranteed zero overselling."**

EventPass is a production-grade full-stack event ticketing platform featuring real-time atomic capacity reservation, Paystack online payment integration (test mode), cryptographic HMAC-SHA512 webhook signature verification, zero-dependency downloadable vector PDF tickets, scannable QR codes, and a full gate check-in turnstile scanner with double-entry fraud prevention.

---

## 🚀 Live Links & Deployment Architecture

- **Frontend Application (Cloudflare Workers)**: [https://event-ticketing-frontend.franc9ok.workers.dev](https://event-ticketing-frontend.franc9ok.workers.dev) (React 18, Vite, TypeScript, Cloudflare Workers Static Assets)
- **Backend API Server**: `http://localhost:4000` (Node.js, Express, Prisma ORM, Neon PostgreSQL)

---

## 🌟 Key Features

* **Atomic Database-Level Concurrency (Zero Overselling)**: Inventory is checked and decremented in a single atomic SQL statement (`UPDATE ... WHERE capacity >= $qty RETURNING *`), preventing overselling during flash-sale bursts.
* **15-Minute Reservation TTL (Auto-Expiration)**: Unpaid reservations automatically expire after 15 minutes, safely releasing capacity back to the available inventory pool.
* **Cryptographic Webhook Verification**: `POST /webhooks/paystack` captures raw request byte buffers and verifies Paystack's HMAC-SHA512 signature in constant time using `crypto.timingSafeEqual`.
* **Idempotent Webhook Processing**: Safe against network duplicate deliveries or replays. Re-delivered payment webhooks return `already_processed` with exactly zero duplicate tickets created.
* **Zero-Dependency Vector PDF Tickets**: Generates crisp, downloadable `.pdf` tickets directly in the browser adhering to the PDF 1.4 specification without any third-party npm packages.
* **ISO/IEC 18004 Scannable QR Codes**: Pure TypeScript QR matrix generation with Level M Reed-Solomon error correction, rendered as responsive inline SVG vector graphics.
* **Organizer Gate Check-In & Scanner Portal**: Staff portal at `/#/check-in` compatible with handheld USB/Bluetooth 2D barcode scanners for turnstile admission.
* **Double-Entry Fraud Prevention**: Real-time gate validation marks tickets `checkedInAt` and blocks duplicated screenshots with `409 Conflict`.
* **Staff Gate Lock Screen**: Restricted terminal access requiring `ADMIN_API_KEY` authentication with session isolation and single-click screen locking.
* **20 Seeded Live Events**: Broad catalog with live search and category filters (`🎵 Music & Festivals`, `💻 Tech & Summits`, `✨ Lifestyle & Comedy`).

---

## 📐 System Architecture & Flow

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    participant Frontend as React + Vite (Vercel)
    participant API as Express API (Render)
    participant DB as PostgreSQL (Neon via Prisma)
    participant Paystack as Paystack API & Webhooks
    actor GateStaff as Venue Gate Staff

    %% 1. Reservation & Checkout Flow
    Buyer->>Frontend: Select event & ticket quantity
    Frontend->>API: POST /api/orders { eventId, buyerEmail, quantity }
    Note over API,DB: Atomic Conditional DB Update:<br/>UPDATE events SET capacity = capacity - Qty<br/>WHERE capacity >= Qty (Zero Overselling)
    API->>Paystack: Initialize Transaction (/transaction/initialize)
    Paystack-->>API: authorization_url, reference
    API-->>Frontend: { order, checkoutUrl, reference }
    Frontend->>Buyer: Redirect to Paystack Checkout
    Buyer->>Paystack: Complete Test Payment

    %% 2. Asynchronous Webhook & Ticket Issuance
    Paystack->>API: POST /webhooks/paystack (x-paystack-signature)
    Note over API,DB: 1. Timing-safe HMAC-SHA512 verification (Raw Buffer)<br/>2. Idempotency Check (status == PAID ? return)<br/>3. Mark Order PAID & Generate Unique Admission Tickets
    API-->>Paystack: 200 OK
    Buyer->>Frontend: Redirected back to return page
    loop Every 2 seconds
        Frontend->>API: GET /api/orders/:reference
        API-->>Frontend: { status: "PAID", tickets: [...] }
    end
    Frontend->>Buyer: Render Scannable QR Code & Download Vector PDF Ticket

    %% 3. Gate Check-In Flow
    GateStaff->>Frontend: Open /#/check-in & Unlock Terminal (ADMIN_API_KEY)
    Buyer->>GateStaff: Present QR Code / Ticket Code at Gate
    GateStaff->>API: POST /api/tickets/check-in { ticketCode }
    Note over API,DB: Check: Order is PAID?<br/>Check: checkedInAt IS NULL?<br/>Set: checkedInAt = now()
    API-->>GateStaff: 200 OK: Valid Admission (or 409 Conflict if already used)
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend Runtime** | Node.js (v24) + TypeScript | Strongly typed REST API server |
| **Framework** | Express.js | Route handling, CORS, middleware, raw body capture |
| **ORM & Database** | Prisma ORM + PostgreSQL (Neon) | Schema modeling, relations, connection pooling |
| **Payment Gateway** | Paystack (Test Mode) | Hosted checkout, transaction initialization, webhooks |
| **Frontend Framework** | React 18 + Vite | Component architecture, responsive UI, polling loops |
| **PDF & QR Engine** | Native TypeScript (Zero Dependencies) | Vector PostScript stream generation, ISO QR encoder |
| **Test Suite** | Vitest + Supertest | Automated concurrency, webhook, check-in, and unit tests |

---

## 🔌 API Endpoints Reference

### Public Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | System health check and server timestamp |
| `GET` | `/api/events` | List all upcoming events with live `remainingCapacity` |
| `GET` | `/api/events/:id` | Get details and ticket availability for a single event |
| `POST` | `/api/orders` | Reserve tickets atomically and initialize Paystack transaction |
| `GET` | `/api/orders/:reference` | Poll order payment status, expiration TTL, and generated tickets |
| `POST` | `/webhooks/paystack` | Paystack webhook endpoint (HMAC-SHA512 signature verified) |

### Admin & Staff Routes (`x-admin-key: <ADMIN_API_KEY>`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/events` | Create a new event with date, venue, price, and capacity |
| `GET` | `/api/admin/events` | List all events with organizer inventory metrics |
| `POST` | `/api/tickets/check-in` | Admit an attendee at the gate, blocking duplicate entry (409) |
| `GET` | `/api/tickets/verify/:ticketCode` | Read-only ticket status inspection before burning |
| `GET` | `/api/tickets/stats/:eventId` | Live gate analytics (admitted count vs. pending arrivals) |

---

## 💻 Local Setup & Development

### 1. Prerequisites
- **Node.js**: v18+ or v20+
- **PostgreSQL**: Neon Serverless PostgreSQL or local PostgreSQL instance
- **Paystack Test Account**: Free developer test account from [Paystack](https://dashboard.paystack.com)

### 2. Environment Configuration
Create a `.env` file inside `backend/.env` based on `backend/.env.example`:

```env
PORT=4000
DATABASE_URL="postgresql://user:password@ep-host.aws.neon.tech/neondb?sslmode=require&schema=event_ticketing"
PAYSTACK_SECRET_KEY="sk_test_mock" # or your real sk_test_... from Paystack
ADMIN_API_KEY="test_admin_secret_key_2026"
FRONTEND_URL="http://localhost:5173"
```

### 3. Backend Installation & Database Setup
```bash
cd backend
npm install

# Push schema to PostgreSQL (creates Event, Order, Ticket tables)
npm run prisma:push

# Generate Prisma Client
npm run prisma:generate

# Seed 20 diverse live events into database
npx tsx prisma/seed.ts

# Start backend dev server
npm run dev
```
The API server will start on `http://localhost:4000`.

### 4. Frontend Installation & Startup
```bash
cd frontend
npm install

# Start Vite dev server
npm run dev
```
The client application will start on `http://localhost:5173`.

---

## 🧪 Running the Automated Test Suite

EventPass includes an automated test suite verifying every core requirement:

```bash
cd backend
npm test
```

### Measured Test Results
```text
Test Files  5 passed (5)
Tests       13 passed (13)

✓ tests/checkin.test.ts (5 tests)
  ✓ rejects unauthenticated check-in with 401 Unauthorized
  ✓ successfully admits a valid, unused ticket and marks it checked in
  ✓ prevents double-entry: rejects an already used ticket with 409 Conflict
  ✓ rejects a fake or non-existent ticket code with 404 Not Found
  ✓ returns gate admission stats accurately for the event

✓ tests/events.test.ts (3 tests)
  ✓ rejects unauthenticated requests to admin event creation with 401
  ✓ creates an event with valid ADMIN_API_KEY header
  ✓ lists events publicly with remainingCapacity

✓ tests/webhook.test.ts (3 tests)
  ✓ Requirement 3: rejects a webhook with an invalid signature with 401 and changes nothing
  ✓ Requirement 2: processes a webhook with a valid signature, marks order PAID, generates tickets
  ✓ Requirement 4: idempotent processing - identical webhook sent twice creates tickets only once

✓ tests/concurrency.test.ts (1 test)
  ✓ proves 50 concurrent orders for 10 tickets result in exactly 10 sold (201) and 40 rejected (409)

✓ tests/expiration.test.ts (1 test)
  ✓ proves expired PENDING orders release their capacity after 15 minutes
```

---

## 🔒 Testing the Paystack Webhook Locally

### Option A: Via Local Browser Simulation
When testing locally without an ngrok tunnel:
1. Complete a test reservation on `http://localhost:5173`.
2. On the Return Page, click **"⚡ Simulate Paystack Webhook Confirmation"**.
3. The page will immediately update to **Payment Confirmed (PAID)**, generating tickets, QR codes, and downloadable PDF tickets.

### Option B: Using cURL with Cryptographic HMAC-SHA512
```bash
# 1. Define webhook payload
PAYLOAD='{"event":"charge.success","data":{"reference":"YOUR_ORDER_REFERENCE","amount":1500000,"status":"success"}}'

# 2. Compute HMAC-SHA512 hash in Node
SIGNATURE=$(node -e "console.log(require('crypto').createHmac('sha512', 'sk_test_mock').update('$PAYLOAD').digest('hex'))")

# 3. Send Webhook
curl -X POST http://localhost:4000/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

Replaying the exact same request verifies **idempotency** — returning `already_processed` with 0 duplicate tickets.

---

## 🛡️ Security & Engineering Best Practices

1. **Zero Overselling via Atomic SQL**: We avoid two-step "read-then-update" checks that fail under race conditions, relying entirely on atomic row-level conditional database constraints.
2. **Timing-Safe Cryptography**: Webhook signatures are compared using `crypto.timingSafeEqual` after length pre-checks to eliminate side-channel timing attack vulnerabilities.
3. **Defense in Depth**: Admin routes and gate terminals are protected by strict API key verification (`ADMIN_API_KEY`).
4. **Clean Session Hygiene**: Gate scanner authorization uses browser `sessionStorage`, automatically revoking staff privileges on browser tab closure.
5. **No Secret Leaks**: Secrets reside exclusively in environment variables (`.env`). `.env` is ignored by `.gitignore` and `.env.example` contains variable names only.

---

## 📄 License
MIT © 2026 EventPass Inc.
