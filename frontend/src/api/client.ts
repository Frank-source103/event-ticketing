import { EventItem, Order, CreateOrderResponse } from '../types/index.ts';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchEvents(): Promise<EventItem[]> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load events');
  }
  return res.json();
}

export async function fetchEventById(id: string): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/events/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load event details');
  }
  return res.json();
}

export async function createOrder(params: {
  eventId: string;
  buyerEmail: string;
  quantity: number;
}): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      callbackUrl: `${window.location.origin}/orders/return`,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reserve tickets');
  }
  return data;
}

export async function fetchOrderByReference(reference: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/orders/${reference}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load order');
  }
  return res.json();
}

export interface CheckInResponse {
  status: 'admitted' | 'already_used' | 'invalid_order';
  message: string;
  ticket?: {
    id: string;
    ticketCode: string;
    checkedInAt: string;
    buyerEmail: string;
    eventTitle: string;
    venue: string;
    orderReference: string;
  };
  checkedInAt?: string;
  error?: string;
}

export async function checkInTicket(ticketCode: string, adminApiKey: string): Promise<CheckInResponse> {
  const res = await fetch(`${API_BASE}/tickets/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminApiKey,
    },
    body: JSON.stringify({ ticketCode }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || `HTTP ${res.status} Check-In Error`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function verifyTicketCode(ticketCode: string, adminApiKey: string) {
  const res = await fetch(`${API_BASE}/tickets/verify/${encodeURIComponent(ticketCode)}`, {
    headers: { 'x-admin-key': adminApiKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function validateAdminKey(adminApiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/events`, {
      headers: { 'x-admin-key': adminApiKey },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
