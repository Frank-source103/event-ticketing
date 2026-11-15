import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { paystackService } from './paystack.service.js';
import { AppError } from '../middleware/errorHandler.js';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id?: number;
    reference: string;
    amount: number;
    status: string;
    paid_at?: string;
    channel?: string;
    currency?: string;
    customer?: {
      email?: string;
    };
  };
}

export class WebhookService {
  /**
   * Idempotently processes Paystack webhook events.
   * Signature verification must be performed before invoking this service.
   */
  async processPaystackEvent(payload: PaystackWebhookPayload) {
    const { event, data } = payload;

    // Only process charge.success events
    if (event !== 'charge.success') {
      return { status: 'ignored', reason: `Unhandled event type: ${event}` };
    }

    const reference = data?.reference;
    if (!reference) {
      throw new AppError('Missing payment reference in webhook payload', 400);
    }

    // Atomic transaction for idempotency and ticket generation
    return prisma.$transaction(
      async (tx) => {
        // Find the order
        const order = await tx.order.findUnique({
          where: { reference },
          include: { tickets: true },
        });

        if (!order) {
          throw new AppError(`Order not found for reference: ${reference}`, 404);
        }

        // IDEMPOTENCY CHECK:
        // If the order is already PAID, return immediately without generating duplicate tickets.
        if (order.status === 'PAID') {
          return {
            status: 'already_processed',
            message: 'Order was already marked as PAID and ticketed.',
            orderId: order.id,
            reference: order.reference,
            ticketsCreated: 0,
            totalTickets: order.tickets.length,
          };
        }

        // Mark the order as PAID
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
          },
        });

        // Generate unique ticket codes for the order quantity
        const ticketRecords = Array.from({ length: order.quantity }, () => ({
          ticketCode: `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          orderId: order.id,
          eventId: order.eventId,
        }));

        await tx.ticket.createMany({
          data: ticketRecords,
        });

        const tickets = await tx.ticket.findMany({
          where: { orderId: order.id },
        });

        return {
          status: 'success',
          message: 'Order marked as PAID and tickets generated.',
          orderId: updatedOrder.id,
          reference: updatedOrder.reference,
          ticketsCreated: ticketRecords.length,
          totalTickets: tickets.length,
          tickets,
        };
      },
      {
        maxWait: 20000,
        timeout: 20000,
      }
    );
  }
}

export const webhookService = new WebhookService();
