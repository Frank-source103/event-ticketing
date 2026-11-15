import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { paystackService } from '../src/services/paystack.service.js';

describe('Paystack Webhook Test Suite', () => {
  const app = createApp();
  const testSecret = 'sk_test_paystack_webhook_super_secret_key_123';
  let testEventId: string;
  let testOrder: any;

  function generateSignature(payload: any, secret: string = testSecret): string {
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha512', secret).update(rawString).digest('hex');
  }

  beforeAll(async () => {
    paystackService.setSecretKey(testSecret);

    // Clean up test data with connection retry
    let retries = 5;
    while (retries > 0) {
      try {
        await prisma.ticket.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.event.deleteMany({});
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const event = await prisma.event.create({
      data: {
        title: 'Neon Nights Festival',
        date: new Date(Date.now() + 86400000),
        venue: 'Metro Dome',
        price: 7500,
        capacity: 20,
      },
    });
    testEventId = event.id;

    // Create a PENDING order with 2 tickets
    testOrder = await prisma.order.create({
      data: {
        reference: `TKT_WEBHOOK_${Date.now()}`,
        buyerEmail: 'festival_goer@example.com',
        quantity: 2,
        totalAmount: 15000,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        eventId: testEventId,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  }, 60000);

  it('Requirement 3: rejects a webhook with an invalid signature with 401 and changes nothing', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: testOrder.reference,
        amount: 15000,
        status: 'success',
      },
    };

    const invalidSignature = 'bad_tampered_signature_00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(app)
      .post('/webhooks/paystack')
      .set('x-paystack-signature', invalidSignature)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/unauthorized/i);

    // Verify order in database is STILL PENDING and has 0 tickets
    const orderInDb = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { tickets: true },
    });

    expect(orderInDb?.status).toBe('PENDING');
    expect(orderInDb?.tickets.length).toBe(0);
  });

  it('Requirement 2: processes a webhook with a valid signature, marks the order PAID, and generates tickets', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: testOrder.reference,
        amount: 15000,
        status: 'success',
      },
    };

    const validSignature = generateSignature(payload, testSecret);

    const res = await request(app)
      .post('/webhooks/paystack')
      .set('x-paystack-signature', validSignature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.ticketsCreated).toBe(2);

    // Verify order in database transitioned to PAID
    const orderInDb = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { tickets: true },
    });

    expect(orderInDb?.status).toBe('PAID');
    expect(orderInDb?.tickets.length).toBe(2);
    expect(orderInDb?.tickets[0].ticketCode).toMatch(/^TKT-[A-F0-9]+-[A-F0-9]+$/);
    expect(orderInDb?.tickets[1].ticketCode).toMatch(/^TKT-[A-F0-9]+-[A-F0-9]+$/);

    // Verify GET /orders/:reference returns PAID status and the generated tickets
    const statusRes = await request(app).get(`/orders/${testOrder.reference}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('PAID');
    expect(statusRes.body.tickets.length).toBe(2);
  });

  it('Requirement 4: idempotent processing - the same webhook sent twice creates tickets only once', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: testOrder.reference,
        amount: 15000,
        status: 'success',
      },
    };

    const validSignature = generateSignature(payload, testSecret);

    // Send the EXACT SAME webhook payload a second time (replay)
    const replayRes = await request(app)
      .post('/webhooks/paystack')
      .set('x-paystack-signature', validSignature)
      .send(payload);

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.status).toBe('already_processed');
    expect(replayRes.body.ticketsCreated).toBe(0);

    // Verify in database: ticket count must STILL be exactly 2
    const orderInDb = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { tickets: true },
    });

    expect(orderInDb?.status).toBe('PAID');
    expect(orderInDb?.tickets.length).toBe(2); // No duplicate tickets!
  });
});
