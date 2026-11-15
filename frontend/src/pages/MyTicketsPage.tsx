import React, { useState, useEffect } from 'react';
import { Order } from '../types/index.ts';
import { fetchOrderByReference } from '../api/client.ts';
import { TicketItem } from '../components/TicketItem.tsx';
import { TicketIcon, SearchIcon, LocationIcon, CalendarIcon, AlertCircleIcon } from '../components/Icons.tsx';

interface MyTicketsPageProps {
  onExploreMore: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ onExploreMore }) => {
  const [searchInput, setSearchInput] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load locally saved orders on mount
  useEffect(() => {
    loadSavedOrders();
  }, []);

  async function loadSavedOrders() {
    try {
      const stored = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (stored.length > 0) {
        setLoading(true);
        const fetchedOrders: Order[] = [];
        for (const item of stored) {
          try {
            const ord = await fetchOrderByReference(item.reference);
            if (ord.status === 'PAID') {
              fetchedOrders.push(ord);
            }
          } catch (_) {}
        }
        setOrders(fetchedOrders);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchInput.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const orderData = await fetchOrderByReference(searchInput.trim());
      if (orderData.status !== 'PAID') {
        setError(`Order found, but status is ${orderData.status}. Tickets are only issued for PAID orders.`);
        return;
      }
      setOrders([orderData]);
    } catch (err: any) {
      setError(err.message || 'No orders found matching that reference.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1rem 5rem' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            My Tickets
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Access scannable admission codes and downloadable PDF tickets for your registered events.
          </p>
        </div>

        {/* Lookup Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          <input
            type="text"
            placeholder="Search by Payment Reference (e.g. ORD_...)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
            aria-label="Payment reference search"
          />
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Searching...' : 'Find Tickets'}
          </button>
        </form>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <AlertCircleIcon size={18} />
            <div>{error}</div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner" role="status" aria-label="Searching for tickets"></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Searching for tickets...</p>
          </div>
        )}

        {!loading && orders.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--slate-850)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              <TicketIcon size={32} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>No Tickets Found</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
              Purchased tickets automatically appear here, or you can search above using your payment reference.
            </p>
            <button onClick={onExploreMore} className="btn btn-primary">
              Browse Live Events
            </button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {orders.map((ord) => (
              <div
                key={ord.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <span className="badge badge-paid" style={{ marginBottom: '0.35rem' }}>
                      Confirmed
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                      {ord.event?.title || 'Live Event'}
                    </h2>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Ref: <span style={{ color: 'var(--text-primary)' }}>{ord.reference}</span>
                  </div>
                </div>

                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {ord.event && (
                    <>
                      <div className="card-info-item">
                        <LocationIcon size={14} className="card-info-icon" />
                        <span>{ord.event.venue}</span>
                      </div>
                      <div className="card-info-item">
                        <CalendarIcon size={14} className="card-info-icon" />
                        <span>{new Date(ord.event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Registered attendee: {ord.buyerEmail}
                  </div>
                </div>

                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Admission Passes ({ord.tickets?.length || 0})
                </h3>

                <div className="ticket-list" style={{ margin: 0 }}>
                  {ord.tickets?.map((t, idx) => (
                    <TicketItem
                      key={t.id}
                      ticket={t}
                      index={idx}
                      event={ord.event}
                      buyerEmail={ord.buyerEmail}
                      orderRef={ord.reference}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
