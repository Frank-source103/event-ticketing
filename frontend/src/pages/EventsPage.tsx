import React, { useEffect, useState, useMemo } from 'react';
import { EventItem } from '../types/index.ts';
import { fetchEvents } from '../api/client.ts';
import { CalendarIcon, LocationIcon, SearchIcon, AlertCircleIcon } from '../components/Icons.tsx';

interface EventsPageProps {
  onSelectEvent: (eventId: string) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ onSelectEvent }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MUSIC' | 'TECH' | 'LIFESTYLE'>('ALL');

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await fetchEvents();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Client-side search and category filtering
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.venue.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFilter === 'ALL') return true;

      const titleLower = ev.title.toLowerCase();
      const venueLower = ev.venue.toLowerCase();

      if (selectedFilter === 'MUSIC') {
        return (
          titleLower.includes('festival') ||
          titleLower.includes('music') ||
          titleLower.includes('jazz') ||
          titleLower.includes('concert') ||
          titleLower.includes('afrobeats') ||
          titleLower.includes('party') ||
          titleLower.includes('electronic')
        );
      }

      if (selectedFilter === 'TECH') {
        return (
          titleLower.includes('tech') ||
          titleLower.includes('ai') ||
          titleLower.includes('summit') ||
          titleLower.includes('fintech') ||
          titleLower.includes('startup') ||
          titleLower.includes('react') ||
          titleLower.includes('web3') ||
          titleLower.includes('cyber') ||
          titleLower.includes('devs')
        );
      }

      if (selectedFilter === 'LIFESTYLE') {
        return (
          titleLower.includes('comedy') ||
          titleLower.includes('food') ||
          titleLower.includes('fashion') ||
          titleLower.includes('wine') ||
          titleLower.includes('stargazing') ||
          titleLower.includes('design') ||
          venueLower.includes('park') ||
          venueLower.includes('beach')
        );
      }

      return true;
    });
  }, [events, searchQuery, selectedFilter]);

  return (
    <div>
      <section className="hero">
        <div className="container">
          <div className="hero-header-row">
            <div>
              <h1 className="hero-title">Live Events & Admissions</h1>
              <p className="hero-subtitle">
                Browse official schedules, real-time ticket availability, and verified gate check-in passes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginBottom: '3rem' }}>
        {/* Search & Category Filter Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            marginBottom: '2rem',
            background: 'var(--bg-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, city, or venue..."
                className="form-input"
                aria-label="Filter events"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn btn-secondary"
                aria-label="Clear search query"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Options */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="group" aria-label="Event category filter">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`btn ${selectedFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '38px', padding: '0 0.85rem', fontSize: '0.8125rem' }}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setSelectedFilter('MUSIC')}
              className={`btn ${selectedFilter === 'MUSIC' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '38px', padding: '0 0.85rem', fontSize: '0.8125rem' }}
            >
              Music & Concerts
            </button>
            <button
              onClick={() => setSelectedFilter('TECH')}
              className={`btn ${selectedFilter === 'TECH' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '38px', padding: '0 0.85rem', fontSize: '0.8125rem' }}
            >
              Tech & Conferences
            </button>
            <button
              onClick={() => setSelectedFilter('LIFESTYLE')}
              className={`btn ${selectedFilter === 'LIFESTYLE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '38px', padding: '0 0.85rem', fontSize: '0.8125rem' }}
            >
              Culture & Comedy
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="spinner" role="status" aria-label="Loading events"></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading event schedule...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ maxWidth: 560, margin: '2rem auto' }}>
            <AlertCircleIcon size={18} />
            <div style={{ flex: 1 }}>{error}</div>
            <button
              onClick={loadEvents}
              className="btn btn-secondary"
              style={{ minHeight: '34px', padding: '0 0.75rem', fontSize: '0.8125rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--slate-850)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              <SearchIcon size={28} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No events match your criteria</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Clear the query or reset categories to view all active listings.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFilter('ALL');
              }}
              className="btn btn-secondary"
              style={{ marginTop: '1.25rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <div className="events-grid">
            {filteredEvents.map((event) => {
              const isSoldOut = event.remainingCapacity <= 0;
              const isLowStock = event.remainingCapacity > 0 && event.remainingCapacity <= 10;

              return (
                <div key={event.id} className="event-card">
                  <div className="card-content">
                    <div className="card-meta">
                      {isSoldOut ? (
                        <span className="badge badge-soldout">Sold Out</span>
                      ) : isLowStock ? (
                        <span className="badge badge-low">{event.remainingCapacity} Left</span>
                      ) : (
                        <span className="badge badge-available">{event.remainingCapacity} Available</span>
                      )}
                    </div>

                    <h2 className="card-title">{event.title}</h2>

                    <div className="card-info">
                      <div className="card-info-item">
                        <CalendarIcon size={15} className="card-info-icon" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      <div className="card-info-item">
                        <LocationIcon size={15} className="card-info-icon" />
                        <span>{event.venue}</span>
                      </div>
                    </div>

                    <div className="card-footer">
                      <div className="price-tag">
                        <span className="price-label">Admission</span>
                        <span className="price-amount">{formatPrice(event.price)}</span>
                      </div>

                      <button
                        onClick={() => onSelectEvent(event.id)}
                        disabled={isSoldOut}
                        className="btn btn-primary"
                      >
                        {isSoldOut ? 'Sold Out' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
