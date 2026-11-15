# Case Study: Engineering a High-Concurrency Event Ticketing Engine with Webhook-Driven Fulfillments

## 1. The Problem

Online event ticketing systems experience acute traffic spikes during ticket drops. When hundreds or thousands of eager buyers click "Purchase" in the same split second for a limited pool of seats, standard web applications suffer from three critical failure modes:

1. **Race Conditions & Overselling**: If available capacity is checked in application memory or through standard non-locking database reads, multiple concurrent requests observe remaining capacity simultaneously, creating more orders than physical seats exist.
2. **Webhook Replay & Duplicate Issuance**: Payment gateways like Paystack operate under an **at-least-once delivery guarantee**. Network timeouts, proxy retries, or server restarts can cause the payment gateway to transmit the exact same payment confirmation webhook multiple times. Naive webhook handlers generate duplicate tickets or trigger double fulfillments.
3. **Inventory Abandonment**: Buyers frequently initiate checkout and abandon their session at the payment gateway screen. If reservations are held indefinitely, inventory becomes artificially depleted, preventing legitimate buyers from purchasing tickets.

---

## 2. The Approach

To resolve these architectural challenges, we implemented a layered backend architecture built with **Node.js, Express, PostgreSQL (Neon), Prisma ORM, and Paystack**:

### A. Database-Layer Concurrency Control
Rather than attempting to synchronize concurrent requests in Node.js application memory (which fails when scaling across multiple server instances or containers), concurrency is enforced directly inside the PostgreSQL database engine:

```sql
UPDATE "event_ticketing"."events"
SET capacity = capacity - $quantity, "updatedAt" = NOW()
WHERE id = $eventId AND capacity >= $quantity
RETURNING id, title, price, capacity;
```

- When 50 concurrent requests hit PostgreSQL, the database engine acquires an immediate row-level lock on the `Event` record.
- The condition `WHERE capacity >= $quantity` is evaluated atomically inside PostgreSQL C code for each queued update.
- As soon as `capacity` reaches 0, subsequent updates return 0 modified rows.
- The API maps zero rows returned to an immediate `HTTP 409 Conflict: Insufficient tickets available`.

### B. 15-Minute Reservation Time-To-Live (TTL)
When an order is initiated, it is assigned a status of `PENDING` with an expiration timestamp (`expiresAt = NOW() + 15 minutes`). If payment is not confirmed within 15 minutes, an expiration sweep resets the order to `EXPIRED` and atomically restores the capacity to the event:

```typescript
await prisma.$transaction([
  prisma.event.update({
    where: { id: order.eventId },
    data: { capacity: { increment: order.quantity } },
  }),
  prisma.order.update({
    where: { id: order.id },
    data: { status: 'EXPIRED' },
  }),
]);
```

### C. Cryptographic Signature Verification on Raw Request Buffers
Before any request parsing or business logic executes on `POST /webhooks/paystack`, the server validates the `x-paystack-signature` header against the raw request body buffer using an HMAC-SHA512 digest:

- Express is configured with `express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })` to capture the unaltered binary byte stream directly off the socket.
- Byte lengths are compared before calling `crypto.timingSafeEqual()` to guarantee constant-time execution and prevent timing attacks without throwing buffer length exceptions.

### D. Idempotent Transactional Webhook Processing
Webhook processing runs inside an interactive database transaction:
- The order is queried by `reference`.
- If `order.status === 'PAID'`, the handler immediately returns `200 OK` with status `already_processed`, issuing **zero duplicate tickets**.
- If `order.status === 'PENDING'`, the order transitions to `PAID` and unique ticket codes (`TKT-XXXX-YYYY`) are generated atomically.

---

## 3. What Failed & Engineering Learnings

Engineering high-concurrency systems against serverless cloud databases surfaces subtle edge cases. Here are the specific failures encountered during development and how they were resolved:

### Failure 1: Multi-Round-Trip Transaction Timeouts Across Remote Latency
- **Symptom**: When firing 50 concurrent requests against Neon PostgreSQL, transactions failed with:
  `Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 7003 ms passed.`
- **Root Cause**: The initial implementation used an interactive transaction that executed four sequential queries over the public internet to Neon AWS in Ohio (`SELECT ... FOR UPDATE`, `SELECT SUM(quantity)`, `order.create`, and `COMMIT`). With 50 transactions competing for the row lock, each taking ~400ms across 4 network round trips, the queue took over 20 seconds to drain, triggering Prisma's 5-second interactive transaction timeout.
- **Resolution**: Replaced the multi-round-trip transaction with a single atomic conditional SQL update: `UPDATE events SET capacity = capacity - $qty WHERE capacity >= $qty RETURNING *`. This collapsed four network hops into **one single round-trip**, executing in milliseconds.

### Failure 2: Connection Pool Exhaustion on Serverless PostgreSQL
- **Symptom**: Under burst traffic, the Prisma query engine logged:
  `Timed out fetching a new connection from the connection pool. (Current connection pool timeout: 30, connection limit: 20)`
- **Root Cause**: Neon's Serverless Free Tier operates with PgBouncer connection limits. Running background database maintenance (`prisma.order.findMany`) on every single incoming checkout request saturated the connection pool.
- **Resolution**: Removed unindexed queries from the hot reservation path. Configured `connection_limit=20` and set `fileParallelism: false` in Vitest so test suites execute in dedicated, sequential processes without connection pool thrashing.

### Failure 3: `crypto.timingSafeEqual` RangeError on Variable Signature Lengths
- **Symptom**: When sending an invalid webhook signature in automated tests, the endpoint returned `500 Internal Server Error` instead of `401 Unauthorized`, logging:
  `RangeError: Input buffers must have the same byte length at PaystackService.verifySignature`.
- **Root Cause**: `crypto.timingSafeEqual(bufA, bufB)` in Node.js throws a runtime exception if the buffers differ in length (e.g. an attacker sends an arbitrary length string).
- **Resolution**: Explicitly checked `if (sigBuffer.byteLength !== expectedBuffer.byteLength) return false;` before invoking `timingSafeEqual`. Tampered requests of any length now cleanly return `401 Unauthorized`.

---

## 4. What Was Measured (Observed Test Evidence)

All performance and correctness claims were verified through the Vitest automated test suite running against the live PostgreSQL database. Here is the actual recorded output:

```text
> event-ticketing-backend@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/itzst/.gemini/antigravity/scratch/event-ticketing/backend

 ✓ tests/events.test.ts (3 tests) 5394ms
   ✓ Admin & Events API Endpoints > creates an event with valid ADMIN_API_KEY header (566ms)
   ✓ Admin & Events API Endpoints > lists events publicly with remainingCapacity (777ms)
   ✓ Admin & Events API Endpoints > rejects unauthenticated requests to admin event creation with 401 (8ms)

 ✓ tests/concurrency.test.ts (1 test) 9598ms
   Status counts: { '201': 10, '409': 40 }
   Concurrency Results: 10 succeeded (201), 40 rejected (409)
   ✓ Concurrency Test: 50 concurrent orders for 10 tickets > proves 50 concurrent orders for 10 remaining tickets result in exactly 10 sold and 40 rejected (5653ms)

 ✓ tests/webhook.test.ts (3 tests) 12177ms
   ✓ Paystack Webhook Test Suite > Requirement 3: rejects a webhook with an invalid signature with 401 and changes nothing (1158ms)
   ✓ Paystack Webhook Test Suite > Requirement 2: processes a webhook with a valid signature, marks the order PAID, and generates tickets (4815ms)
   ✓ Paystack Webhook Test Suite > Requirement 4: idempotent processing - the same webhook sent twice creates tickets only once (1636ms)

 ✓ tests/expiration.test.ts (1 test) 9490ms
   ✓ Expiration Test: Expired PENDING orders release their capacity > proves that expired PENDING orders release their capacity so new orders succeed (5571ms)

 Test Files  4 passed (4)
      Tests  8 passed (8)
   Start at  14:41:53
   Duration  40.42s
```

### Metrics Summary:
| Success Criterion | Target Metric | Observed Measured Result | Outcome |
|---|---|---|---|
| **50 Concurrent Requests for 10 Tickets** | Exactly 10 sold (201), 40 rejected (409) | `201: 10`, `409: 40`, `0 oversold` | **PASSED** (100% precision) |
| **Tampered Webhook Rejection** | 401 Unauthorized, 0 DB modifications | Status `401`, 0 tickets generated | **PASSED** (1,158 ms) |
| **Valid Webhook Fulfillment** | Order marked `PAID`, unique tickets issued | Status `PAID`, 2 tickets issued | **PASSED** (4,815 ms) |
| **Duplicate Webhook Replay** | Exactly 1 issuance, 0 duplicate tickets | Status `already_processed`, 0 added | **PASSED** (1,636 ms) |
| **15-Min Reservation Expiration** | Capacity recovered and re-orderable | Original marked `EXPIRED`, new order `201` | **PASSED** (5,571 ms) |
