import React, { useEffect, useState } from 'react';
import { EventItem } from '../types/index.ts';
import { fetchEventById, createOrder } from '../api/client.ts';
import { ArrowLeftIcon, CalendarIcon, LocationIcon, TicketIcon, ShieldIcon, AlertCircleIcon } from '../components/Icons.tsx';

interface EventDetailPageProps {
  eventId: string;
  onBack: () => void;
  onOrderCreated: (reference: string) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  eventId,
  onBack,
  onOrderCreated,
}) => {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    try {
      setLoading(true);
      const data = await fetchEventById(eventId);
      setEvent(data);
      if (data.remainingCapacity <= 0) {
        setQuantity(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(amountInKobo: number) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amountInKobo / 100);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;

    if (!email || !email.includes('@')) {
      setCheckoutError('Please enter a valid email address');
      return;
    }

    if (quantity <= 0) {
      setCheckoutError('Please select at least 1 ticket');
      return;
    }

    try {
      setSubmitting(true);
      setCheckoutError(null);
      const cleanEmail = email.trim();

      const result = await createOrder({
        eventId: event.id,
        buyerEmail: cleanEmail,
        quantity,
      });

      // Save order reference locally for "My Tickets"
      try {
        const stored = JSON.parse(localStorage.getItem('my_orders') || '[]');
        stored.unshift({ reference: result.reference, email: cleanEmail });
        localStorage.setItem('my_orders', JSON.stringify(stored.slice(0, 10)));
      } catch (_) {}

      // If in mock or test mode without external browser redirect:
      if (result.checkoutUrl.includes('test-mock')) {
        // Mock checkout URL: redirect directly to return page
        onOrderCreated(result.reference);
      } else {
        // Live Paystack test checkout redirect
        window.location.href = result.checkoutUrl;
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Reservation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '6rem 0' }}>
        <div className="spinner" role="status" aria-label="Loading event details"></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading event details...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="container" style={{ padding: '4rem 0' }}>
        <div className="alert alert-danger" style={{ maxWidth: 500, margin: '0 auto' }}>
          <AlertCircleIcon size={18} />
          <div>{error || 'Event not found'}</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button onClick={onBack} className="btn btn-secondary">
            <ArrowLeftIcon size={14} />
            <span>Back to Events</span>
          </button>
        </div>
      </div>
    );
  }

  const isSoldOut = event.remainingCapacity <= 0;
  const totalAmount = event.price * quantity;

  return (
    <div className="container">
      <div style={{ padding: '1.5rem 0 0.5rem' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '0 0.85rem' }}>
          <ArrowLeftIcon size={14} />
          <span>Back to Events</span>
        </button>
      </div>

      <div className="detail-layout">
        {/* Main Event Details */}
        <div className="detail-main">
          <div style={{ marginBottom: '1.25rem' }}>
            {isSoldOut ? (
              <span className="badge badge-soldout">Sold Out</span>
            ) : (
              <span className="badge badge-available">{event.remainingCapacity} Tickets Available</span>
            )}
          </div>

          <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 700, marginBottom: '1.25rem' }}>
            {event.title}
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '2rem' }}>
            <div className="card-info-item">
              <CalendarIcon size={16} className="card-info-icon" />
              <span>{formatDate(event.date)}</span>
            </div>
            <div className="card-info-item">
              <LocationIcon size={16} className="card-info-icon" />
              <span>{event.venue}</span>
            </div>
            <div className="card-info-item">
              <TicketIcon size={16} className="card-info-icon" />
              <span>{event.capacity} total venue capacity</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Admission Policies
            </h2>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.875rem' }}>
              <li>Capacity is locked in real-time at the database level upon starting checkout.</li>
              <li>Pending reservations are held for <strong>15 minutes</strong> before being released back to public availability.</li>
              <li>Direct verification QR code and PDF ticket are generated immediately upon verified payment.</li>
            </ul>
          </div>
        </div>

        {/* Checkout Card */}
        <div className="checkout-box">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            Ticket Checkout
          </h2>

          {checkoutError && (
            <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>
              <AlertCircleIcon size={16} />
              <div>{checkoutError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Quantity Picker */}
            <div className="form-group">
              <label className="form-label">Ticket Quantity</label>
              <div className="quantity-picker">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isSoldOut}
                  aria-label="Decrease ticket quantity"
                >
                  −
                </button>
                <span className="qty-display">{quantity}</span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.min(event.remainingCapacity, q + 1))}
                  disabled={quantity >= event.remainingCapacity || isSoldOut}
                  aria-label="Increase ticket quantity"
                >
                  +
                </button>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  (Max {event.remainingCapacity})
                </span>
              </div>
            </div>

            {/* Email Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="buyerEmail">Attendee Email Address</label>
              <input
                id="buyerEmail"
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || isSoldOut}
                className="form-input"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Your scannable ticket and receipt will be delivered to this email.
              </span>
            </div>

            {/* Price Summary */}
            <div className="summary-table">
              <div className="summary-row">
                <span>Unit Price</span>
                <span>{formatPrice(event.price)}</span>
              </div>
              <div className="summary-row">
                <span>Quantity</span>
                <span>× {quantity}</span>
              </div>
              <div className="summary-total">
                <span>Total Due</span>
                <span>{formatPrice(totalAmount)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isSoldOut}
              className="btn btn-primary btn-block"
            >
              {submitting ? 'Reserving Tickets...' : isSoldOut ? 'Sold Out' : 'Pay with Paystack'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldIcon size={13} />
              <span>Secured by Paystack • 15-minute hold</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
