import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { paystackService } from './paystack.service.js';

export interface CreateOrderInput {
  eventId: string;
  buyerEmail: string;
  quantity: number;
  callbackUrl?: string;
}

export class OrderService {
  /**
   * Reserves tickets and creates a PENDING order with a 15-minute expiration.
   * Concurrency is enforced at the database layer using atomic conditional decrement (UPDATE ... WHERE capacity >= quantity).
   */
  async createOrder(input: CreateOrderInput) {
    const { eventId, buyerEmail, quantity, callbackUrl } = input;

    if (!eventId || !buyerEmail || !quantity) {
      throw new AppError('eventId, buyerEmail, and quantity are required', 400);
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new AppError('Quantity must be a positive integer', 400);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      throw new AppError('Invalid email format', 400);
    }

    const reference = `TKT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Step 1: Atomic database-level conditional update
    // Guarantees zero overselling even under massive concurrency by acquiring an immediate row lock
    const updatedEvents: any = await prisma.$queryRaw`
      UPDATE "event_ticketing"."events"
      SET capacity = capacity - ${quantity}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND capacity >= ${quantity}
      RETURNING id, title, price, capacity
    `;

    if (!updatedEvents || updatedEvents.length === 0) {
      // Determine if event exists or capacity exhausted
      const eventExists = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });
      if (!eventExists) {
        throw new AppError('Event not found', 404);
      }
      throw new AppError('Insufficient tickets available', 409);
    }

    const event = updatedEvents[0];
    const totalAmount = event.price * quantity;

    // Step 2: Insert the PENDING order
    const createdOrder = await prisma.order.create({
      data: {
        reference,
        buyerEmail,
        quantity,
        totalAmount,
        status: 'PENDING',
        expiresAt,
        eventId,
      },
    });

    // Step 4: Initialize Paystack transaction
    try {
      const paystackRes = await paystackService.initializeTransaction({
        email: buyerEmail,
        amount: createdOrder.totalAmount,
        reference: createdOrder.reference,
        callbackUrl,
      });

      return {
        order: createdOrder,
        checkoutUrl: paystackRes.authorization_url,
        reference: createdOrder.reference,
      };
    } catch (err: any) {
      // Restore capacity and mark order FAILED
      await prisma.$transaction([
        prisma.event.update({
          where: { id: eventId },
          data: { capacity: { increment: quantity } },
        }),
        prisma.order.update({
          where: { id: createdOrder.id },
          data: { status: 'FAILED' },
        }),
      ]);
      throw new AppError(`Payment initialization failed: ${err.message}`, 502);
    }
  }

  /**
   * Retrieves order status and its generated tickets (if paid).
   */
  async getOrderByReference(reference: string) {
    if (!reference) {
      throw new AppError('Order reference is required', 400);
    }

    const order = await prisma.order.findUnique({
      where: { reference },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: true,
            price: true,
          },
        },
        tickets: {
          select: {
            id: true,
            ticketCode: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // If order is still pending but past expiration, update status and release capacity
    if (order.status === 'PENDING' && new Date() > order.expiresAt) {
      const [_, updated] = await prisma.$transaction([
        prisma.event.update({
          where: { id: order.eventId },
          data: { capacity: { increment: order.quantity } },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' },
          include: {
            event: true,
            tickets: true,
          },
        }),
      ]);
      return updated;
    }

    return order;
  }

  /**
   * Release expired pending orders across the database.
   */
  async expireStaleOrders(): Promise<number> {
    const now = new Date();
    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
    });

    if (staleOrders.length === 0) return 0;

    for (const order of staleOrders) {
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
    }

    return staleOrders.length;
  }
}

export const orderService = new OrderService();
