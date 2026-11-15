import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateEventInput {
  title: string;
  date: string | Date;
  venue: string;
  price: number;
  capacity: number;
}

export class EventService {
  async createEvent(data: CreateEventInput) {
    if (!data.title || !data.venue || !data.date || data.price === undefined || data.capacity === undefined) {
      throw new AppError('Missing required event fields: title, date, venue, price, capacity', 400);
    }

    if (data.capacity <= 0) {
      throw new AppError('Event capacity must be greater than zero', 400);
    }

    if (data.price < 0) {
      throw new AppError('Event price cannot be negative', 400);
    }

    return prisma.event.create({
      data: {
        title: data.title,
        date: new Date(data.date),
        venue: data.venue,
        price: data.price,
        capacity: data.capacity,
      },
    });
  }

  async listEvents(includePrivateDetails: boolean = false) {
    const events = await prisma.event.findMany({
      orderBy: { date: 'asc' },
    });

    return events.map((event) => {
      const base = {
        id: event.id,
        title: event.title,
        date: event.date,
        venue: event.venue,
        price: event.price,
        capacity: event.capacity,
        remainingCapacity: event.capacity,
        createdAt: event.createdAt,
      };

      if (includePrivateDetails) {
        return {
          ...base,
        };
      }

      return base;
    });
  }

  async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    return {
      id: event.id,
      title: event.title,
      date: event.date,
      venue: event.venue,
      price: event.price,
      capacity: event.capacity,
      remainingCapacity: event.capacity,
      createdAt: event.createdAt,
    };
  }
}

export const eventService = new EventService();
