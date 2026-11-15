import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Concurrency Test: 50 concurrent orders for 10 tickets', () => {
  const app = createApp();
  let testEventId: string;

  beforeAll(async () => {
    process.env.MOCK_PAYSTACK = 'true';
    process.env.ADMIN_API_KEY = 'test_admin_key';

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

    // Create an event with exactly 10 tickets capacity
    const event = await prisma.event.create({
      data: {
        title: 'High-Concurrency Rock Concert',
        date: new Date(Date.now() + 86400000), // tomorrow
        venue: 'Grand Arena',
        price: 5000,
        capacity: 10,
      },
    });
    testEventId = event.id;
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  }, 60000);

  it('proves 50 concurrent orders for 10 remaining tickets result in exactly 10 sold and 40 rejected', async () => {
    const concurrentRequestsCount = 50;

    // Fire 50 simultaneous order requests at the same exact time
    const promises = Array.from({ length: concurrentRequestsCount }, (_, i) =>
      request(app)
        .post('/api/orders')
        .send({
          eventId: testEventId,
          buyerEmail: `buyer_${i + 1}@example.com`,
          quantity: 1,
        })
    );

    const responses = await Promise.all(promises);

    const statusCounts: Record<number, number> = {};
    for (const r of responses) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      if (r.status !== 201 && r.status !== 409) {
        console.log(`Unexpected status: ${r.status}, body:`, r.body);
      }
    }
    console.log('Status counts:', statusCounts);

    const successfulOrders = responses.filter((r) => r.status === 201);
    const rejectedOrders = responses.filter((r) => r.status === 409);

    console.log(`Concurrency Results: ${successfulOrders.length} succeeded (201), ${rejectedOrders.length} rejected (409)`);

    // Criteria: Exactly 10 sold, exactly 40 rejected
    expect(successfulOrders.length).toBe(10);
    expect(rejectedOrders.length).toBe(40);

    // Verify in database: total reserved count must be exactly 10
    const ordersInDb = await prisma.order.findMany({
      where: { eventId: testEventId },
    });

    const totalQuantityReserved = ordersInDb.reduce((sum, o) => sum + o.quantity, 0);
    expect(totalQuantityReserved).toBe(10);

    // 51st request MUST also fail
    const extraAttempt = await request(app)
      .post('/api/orders')
      .send({
        eventId: testEventId,
        buyerEmail: 'latecomer@example.com',
        quantity: 1,
      });

    expect(extraAttempt.status).toBe(409);
    expect(extraAttempt.body.error).toMatch(/insufficient/i);
  }, 60000);
});
