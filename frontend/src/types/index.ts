export interface EventItem {
  id: string;
  title: string;
  date: string;
  venue: string;
  price: number; // in smallest currency unit (e.g. kobo / cents)
  capacity: number;
  remainingCapacity: number;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketCode: string;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

export interface Order {
  id: string;
  reference: string;
  buyerEmail: string;
  status: OrderStatus;
  quantity: number;
  totalAmount: number;
  expiresAt: string;
  createdAt: string;
  event?: EventItem;
  tickets?: Ticket[];
}

export interface CreateOrderResponse {
  order: Order;
  checkoutUrl: string;
  reference: string;
}
