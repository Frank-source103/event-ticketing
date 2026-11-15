import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { orderService } from '../src/services/order.service.js';

describe('Expiration Test: Expired PENDING orders release their capacity', () => {
  const app = createApp();
  let testEventId: string;

  beforeAll(async () => {
    process.env.MOCK_PAYSTACK = 'true';
    process.env.ADMIN_API_KEY = 'test_admin_key';

    await prisma.ticket.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.event.deleteMany({});

    const event = await prisma.event.create({
      data: {
        title: 'Intimate Jazz Night',
        date: new Date(Date.now() + 86400000),
        venue: 'The Blue Note',
        price: 3000,
        capacity: 2, // Only 2 tickets total
      },
    });
    testEventId = event.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('proves that expired PENDING orders release their capacity so new orders succeed', async () => {
    // 1. Order all 2 tickets
    const firstOrderRes = await request(app)
      .post('/api/orders')
      .send({
        eventId: testEventId,
        buyerEmail: 'first_buyer@example.com',
        quantity: 2,
      });

    expect(firstOrderRes.status).toBe(201);
    expect(firstOrderRes.body.order.status).toBe('PENDING');

    // 2. Second buyer tries to buy 1 ticket while the first order is still pending (within 15 mins)
    const blockedRes = await request(app)
      .post('/api/orders')
      .send({
        eventId: testEventId,
        buyerEmail: 'second_buyer@example.com',
        quantity: 1,
      });

    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.error).toMatch(/insufficient/i);

    // 3. Simulate passage of time past 15 minutes by updating the pending order's expiresAt to 16 minutes in the past
    const pastDate = new Date(Date.now() - 16 * 60 * 1000);
    await prisma.order.update({
      where: { id: firstOrderRes.body.order.id },
      data: { expiresAt: pastDate },
    });

    // Explicitly run expiration sweep to release capacity
    await orderService.expireStaleOrders();

    // 4. Now a third buyer tries to purchase the 2 tickets
    const thirdOrderRes = await request(app)
      .post('/api/orders')
      .send({
        eventId: testEventId,
        buyerEmail: 'third_buyer@example.com',
        quantity: 2,
      });

    expect(thirdOrderRes.status).toBe(201);
    expect(thirdOrderRes.body.order.status).toBe('PENDING');

    // 5. Verify that the original order is marked EXPIRED
    const originalOrder = await prisma.order.findUnique({
      where: { id: firstOrderRes.body.order.id },
    });
    expect(originalOrder?.status).toBe('EXPIRED');
  });
});
