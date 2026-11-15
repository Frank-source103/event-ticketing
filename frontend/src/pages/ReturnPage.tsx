import React, { useEffect, useState } from 'react';
import { Order } from '../types/index.ts';
import { fetchOrderByReference } from '../api/client.ts';
import { TicketItem } from '../components/TicketItem.tsx';
import { CheckIcon, AlertCircleIcon, CalendarIcon, LocationIcon } from '../components/Icons.tsx';

interface ReturnPageProps {
  reference: string;
  onExploreMore: () => void;
  onViewMyTickets: () => void;
}

export const ReturnPage: React.FC<ReturnPageProps> = ({
  reference,
  onExploreMore,
  onViewMyTickets,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!reference) return;

    let isMounted = true;
    let pollInterval: any = null;

    async function checkStatus() {
      try {
        const data = await fetchOrderByReference(reference);
        if (!isMounted) return;

        setOrder(data);
        setLoading(false);

        // If terminal state reached (PAID, FAILED, EXPIRED), stop polling
        if (data.status === 'PAID' || data.status === 'FAILED' || data.status === 'EXPIRED') {
          clearInterval(pollInterval);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Error checking order status');
        setLoading(false);
      }
    }

    // Initial check
    checkStatus();

    // Poll every 2 seconds
    pollInterval = setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reference]);

  async function handleSimulateWebhook() {
    if (!order) return;
    try {
      setSimulating(true);
      setError(null);
      // In local dev/test mode, trigger payment confirmation
      const res = await fetch('/webhooks/paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': 'simulated_dev_webhook',
        },
        body: JSON.stringify({
          event: 'charge.success',
          data: {
            reference: order.reference,
            amount: order.totalAmount,
            status: 'success',
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Simulation returned HTTP ${res.status}`);
      }

      // Immediate refresh
      const refreshed = await fetchOrderByReference(order.reference);
      setOrder(refreshed);
    } catch (e: any) {
      console.error('Simulation error:', e);
      setError(e.message || 'Failed to simulate payment webhook.');
    } finally {
      setSimulating(false);
    }
  }

  function formatPrice(amountInKobo: number) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amountInKobo / 100);
  }

  if (loading && !order) {
    return (
      <div className="container">
        <div className="status-card" style={{ textAlign: 'center' }}>
          <div className="spinner" role="status" aria-label="Verifying payment"></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Verifying Payment Status</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Checking reference <code style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{reference}</code>
          </p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="container">
        <div className="status-card" style={{ textAlign: 'center' }}>
          <div className="status-icon failed" style={{ margin: '0 auto 1rem' }}>
            <AlertCircleIcon size={24} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Order Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={onExploreMore} className="btn btn-primary">
            Explore Events
          </button>
        </div>
      </div>
    );
  }

  const isPending = order?.status === 'PENDING';
  const isPaid = order?.status === 'PAID';
  const isFailed = order?.status === 'FAILED';
  const isExpired = order?.status === 'EXPIRED';

  return (
    <div className="container">
      <div className="status-card">
        {/* PENDING State (Waiting for Webhook) */}
        {isPending && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="spinner" style={{ width: '1.5rem', height: '1.5rem', borderWidth: '2px', margin: 0 }}></div>
              <span className="badge badge-pending">
                Awaiting Payment Confirmation
              </span>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>
              Transaction Processing
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Listening for the payment webhook notification from Paystack. Tickets will be issued automatically once confirmed.
            </p>

            <div style={{ background: 'var(--slate-850)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Reference:</span> <code style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{order?.reference}</code></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Total:</span> <span>{order && formatPrice(order.totalAmount)}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Buyer:</span> <span>{order?.buyerEmail}</span></div>
            </div>

            {/* Test Helper Simulation for Dev/Local Environment */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Local development simulation:
              </p>
              <button
                onClick={handleSimulateWebhook}
                disabled={simulating}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', minHeight: '38px' }}
              >
                {simulating ? 'Processing Webhook...' : 'Simulate Paystack Confirmation'}
              </button>
            </div>
          </div>
        )}

        {/* PAID State (Success) */}
        {isPaid && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="status-icon success" style={{ width: '2rem', height: '2rem', margin: 0 }}>
                <CheckIcon size={16} />
              </div>
              <span className="badge badge-paid">
                Payment Confirmed
              </span>
            </div>

            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, margin: '0.5rem 0' }}>
              Order Confirmed
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
              Your payment of {order && formatPrice(order.totalAmount)} has been verified. Present your ticket code or QR at the gate.
            </p>

            {/* Event Summary */}
            {order?.event && (
              <div style={{ background: 'var(--slate-850)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{order.event.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <div className="card-info-item">
                    <LocationIcon size={14} className="card-info-icon" />
                    <span>{order.event.venue}</span>
                  </div>
                  <div className="card-info-item">
                    <CalendarIcon size={14} className="card-info-icon" />
                    <span>{new Date(order.event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Generated Ticket Passes */}
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Admission Passes ({order?.tickets?.length || 0})
            </h2>
            <div className="ticket-list">
              {order?.tickets?.map((t, idx) => (
                <TicketItem
                  key={t.id}
                  ticket={t}
                  index={idx}
                  event={order?.event}
                  buyerEmail={order?.buyerEmail}
                  orderRef={order?.reference}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.75rem' }}>
              <button onClick={onViewMyTickets} className="btn btn-secondary">
                View My Tickets
              </button>
              <button onClick={onExploreMore} className="btn btn-primary">
                Browse More Events
              </button>
            </div>
          </div>
        )}

        {/* FAILED State */}
        {isFailed && (
          <div>
            <div className="status-icon failed">
              <AlertCircleIcon size={20} />
            </div>
            <span className="badge badge-failed" style={{ marginBottom: '0.75rem' }}>
              Payment Failed
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>
              Transaction Incomplete
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              The payment was cancelled or could not be verified. Reserved tickets have been returned to available inventory.
            </p>
            <button onClick={onExploreMore} className="btn btn-primary">
              Try Again
            </button>
          </div>
        )}

        {/* EXPIRED State */}
        {isExpired && (
          <div>
            <div className="status-icon failed">
              <CalendarIcon size={20} />
            </div>
            <span className="badge badge-expired" style={{ marginBottom: '0.75rem' }}>
              Reservation Expired
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>
              Reservation Expired
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Pending reservations expire after 15 minutes. The tickets have been released back to other attendees.
            </p>
            <button onClick={onExploreMore} className="btn btn-primary">
              Reserve New Tickets
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
