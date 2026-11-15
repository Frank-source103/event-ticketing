import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Organizer Gate Check-In & Ticket Verification', () => {
  const app = createApp();
  const adminKey = 'test_admin_secret_key_2026';
  let testEventId: string;
  let testTicketCode: string;

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = adminKey;

    // Create an event
    const event = await prisma.event.create({
      data: {
        title: 'Gate Check-In Showcase 2026',
        date: new Date(Date.now() + 86400000),
        venue: 'Grand Exhibition Hall',
        price: 12000,
        capacity: 50,
      },
    });
    testEventId = event.id;

    // Create a confirmed PAID order
    const order = await prisma.order.create({
      data: {
        reference: `ORD_CHECKIN_TEST_${Date.now()}`,
        buyerEmail: 'vip_guest@example.com',
        quantity: 1,
        totalAmount: 12000,
        status: 'PAID',
        expiresAt: new Date(Date.now() + 86400000),
        eventId: testEventId,
      },
    });

    // Create a ticket for this order
    const ticket = await prisma.ticket.create({
      data: {
        ticketCode: `TKT-GATE-${Date.now().toString().slice(-6)}-01`,
        orderId: order.id,
        eventId: testEventId,
      },
    });
    testTicketCode = ticket.ticketCode;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated check-in with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .send({ ticketCode: testTicketCode });

    expect(res.status).toBe(401);
  });

  it('successfully admits a valid, unused ticket and marks it checked in', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('x-admin-key', adminKey)
      .send({ ticketCode: testTicketCode });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('admitted');
    expect(res.body.ticket.ticketCode).toBe(testTicketCode);
    expect(res.body.ticket.buyerEmail).toBe('vip_guest@example.com');
    expect(res.body.ticket.checkedInAt).toBeDefined();

    // Verify in database: checkedInAt is populated
    const inDb = await prisma.ticket.findUnique({
      where: { ticketCode: testTicketCode },
    });
    expect(inDb?.checkedInAt).not.toBeNull();
  });

  it('prevents double-entry: rejects an already used ticket with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('x-admin-key', adminKey)
      .send({ ticketCode: testTicketCode });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already used/i);
    expect(res.body.status).toBe('already_used');
    expect(res.body.checkedInAt).toBeDefined();
  });

  it('rejects a fake or non-existent ticket code with 404 Not Found', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('x-admin-key', adminKey)
      .send({ ticketCode: 'TKT-NONEXISTENT-999' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns gate admission stats accurately for the event', async () => {
    const res = await request(app)
      .get(`/api/tickets/stats/${testEventId}`)
      .set('x-admin-key', adminKey);

    expect(res.status).toBe(200);
    expect(res.body.totalTickets).toBeGreaterThanOrEqual(1);
    expect(res.body.checkedInTickets).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingArrivals).toBe(res.body.totalTickets - res.body.checkedInTickets);
  });
});
