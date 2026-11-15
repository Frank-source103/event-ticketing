import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Admin & Events API Endpoints', () => {
  const app = createApp();

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = 'test_admin_secret_key_2026';
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests to admin event creation with 401', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .send({
        title: 'Secret VIP Showcase',
        date: new Date().toISOString(),
        venue: 'Underground Club',
        price: 15000,
        capacity: 50,
      });

    expect(res.status).toBe(401);
  });

  it('creates an event with valid ADMIN_API_KEY header', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .set('x-admin-key', 'test_admin_secret_key_2026')
      .send({
        title: 'Tech & Music Festival 2026',
        date: new Date(Date.now() + 86400000).toISOString(),
        venue: 'Main Arena',
        price: 8000,
        capacity: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Tech & Music Festival 2026');
  });

  it('lists events publicly with remainingCapacity', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const createdEvent = res.body.find((e: any) => e.title === 'Tech & Music Festival 2026');
    expect(createdEvent).toBeDefined();
    expect(createdEvent.remainingCapacity).toBe(100);
  });
});
