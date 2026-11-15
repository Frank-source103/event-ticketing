import { prisma } from '../lib/prisma.js';

export interface CheckInResult {
  status: 'admitted' | 'already_used' | 'invalid_order';
  message: string;
  ticket?: {
    id: string;
    ticketCode: string;
    checkedInAt: Date;
    buyerEmail: string;
    eventTitle: string;
    venue: string;
    orderReference: string;
  };
  previousCheckIn?: Date;
}

export class CheckInService {
  /**
   * Validates and checks in an admission ticket code at the gate.
   * Enforces that tickets can only be used ONCE.
   */
  async checkInTicket(ticketCode: string): Promise<CheckInResult> {
    const trimmedCode = ticketCode.trim();

    // 1. Find ticket by code with event and order details
    const ticket = await prisma.ticket.findUnique({
      where: { ticketCode: trimmedCode },
      include: {
        order: true,
        event: true,
      },
    });

    if (!ticket) {
      const error: any = new Error(`Ticket "${trimmedCode}" not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Ensure order is confirmed PAID
    if (ticket.order.status !== 'PAID') {
      const error: any = new Error(
        `Ticket is invalid because order ${ticket.order.reference} has status ${ticket.order.status}.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Fraud / Double-entry prevention: check if already used
    if (ticket.checkedInAt) {
      const error: any = new Error(
        `Ticket ${trimmedCode} was ALREADY USED at ${ticket.checkedInAt.toISOString()}.`
      );
      error.statusCode = 409;
      error.data = {
        status: 'already_used',
        ticketCode: ticket.ticketCode,
        checkedInAt: ticket.checkedInAt,
        buyerEmail: ticket.order.buyerEmail,
        eventTitle: ticket.event.title,
      };
      throw error;
    }

    // 4. Mark ticket as checked in atomically
    const now = new Date();
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { checkedInAt: now },
      include: {
        order: true,
        event: true,
      },
    });

    return {
      status: 'admitted',
      message: 'Valid admission. Welcome to the event!',
      ticket: {
        id: updatedTicket.id,
        ticketCode: updatedTicket.ticketCode,
        checkedInAt: updatedTicket.checkedInAt!,
        buyerEmail: updatedTicket.order.buyerEmail,
        eventTitle: updatedTicket.event.title,
        venue: updatedTicket.event.venue,
        orderReference: updatedTicket.order.reference,
      },
    };
  }

  /**
   * Read-only lookup for gate scanners to preview ticket status without consuming it.
   */
  async getTicketStatus(ticketCode: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketCode: ticketCode.trim() },
      include: {
        order: { select: { status: true, buyerEmail: true, reference: true } },
        event: { select: { title: true, date: true, venue: true } },
      },
    });

    if (!ticket) {
      const error: any = new Error(`Ticket "${ticketCode}" not found.`);
      error.statusCode = 404;
      throw error;
    }

    return {
      ticketCode: ticket.ticketCode,
      isPaid: ticket.order.status === 'PAID',
      isCheckedIn: !!ticket.checkedInAt,
      checkedInAt: ticket.checkedInAt,
      attendee: ticket.order.buyerEmail,
      event: ticket.event,
    };
  }

  /**
   * Real-time gate stats: how many attendees have checked in vs total tickets issued.
   */
  async getGateStats(eventId: string) {
    const totalTickets = await prisma.ticket.count({
      where: { eventId },
    });

    const checkedInTickets = await prisma.ticket.count({
      where: { eventId, checkedInAt: { not: null } },
    });

    return {
      eventId,
      totalTickets,
      checkedInTickets,
      pendingArrivals: totalTickets - checkedInTickets,
    };
  }
}

export const checkInService = new CheckInService();
