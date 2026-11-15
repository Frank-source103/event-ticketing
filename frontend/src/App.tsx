import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { EventsPage } from './pages/EventsPage.tsx';
import { EventDetailPage } from './pages/EventDetailPage.tsx';
import { ReturnPage } from './pages/ReturnPage.tsx';
import { MyTicketsPage } from './pages/MyTicketsPage.tsx';
import { CheckInPage } from './pages/CheckInPage.tsx';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname !== '/' ? window.location.pathname : window.location.hash.replace('#', '') || '/';
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);

  useEffect(() => {
    function handleLocationChange() {
      // Check query parameters for order return
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('reference');
      if (ref) {
        setOrderReference(ref);
        setCurrentPath('/orders/return');
        return;
      }

      const path = window.location.pathname !== '/' 
        ? window.location.pathname 
        : window.location.hash.replace('#', '') || '/';

      if (path.startsWith('/events/')) {
        const id = path.replace('/events/', '');
        setSelectedEventId(id);
        setCurrentPath('/events/:id');
      } else if (path.startsWith('/orders/return')) {
        setCurrentPath('/orders/return');
      } else if (path === '/my-tickets') {
        setCurrentPath('/my-tickets');
      } else if (path === '/check-in') {
        setCurrentPath('/check-in');
      } else {
        setCurrentPath('/');
      }
    }

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  function navigate(path: string) {
    window.location.hash = path;
    if (path === '/') {
      setSelectedEventId(null);
      setCurrentPath('/');
    } else if (path.startsWith('/events/')) {
      const id = path.replace('/events/', '');
      setSelectedEventId(id);
      setCurrentPath('/events/:id');
    } else if (path === '/my-tickets') {
      setCurrentPath('/my-tickets');
    } else if (path === '/check-in') {
      setCurrentPath('/check-in');
    } else if (path.startsWith('/orders/return')) {
      setCurrentPath('/orders/return');
    }
  }

  function handleSelectEvent(id: string) {
    navigate(`/events/${id}`);
  }

  function handleOrderCreated(ref: string) {
    setOrderReference(ref);
    navigate(`/orders/return?reference=${ref}`);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentPath={currentPath} onNavigate={navigate} />

      <main style={{ flex: 1 }}>
        {currentPath === '/' && (
          <EventsPage onSelectEvent={handleSelectEvent} />
        )}

        {currentPath === '/events/:id' && selectedEventId && (
          <EventDetailPage
            eventId={selectedEventId}
            onBack={() => navigate('/')}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {currentPath === '/orders/return' && (
          <ReturnPage
            reference={orderReference || new URLSearchParams(window.location.search).get('reference') || ''}
            onExploreMore={() => navigate('/')}
            onViewMyTickets={() => navigate('/my-tickets')}
          />
        )}

        {currentPath === '/my-tickets' && (
          <MyTicketsPage onExploreMore={() => navigate('/')} />
        )}

        {currentPath === '/check-in' && (
          <CheckInPage />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '2.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <div className="container">
          <p>© 2026 EventPass Inc. Built with Node.js, Express, Neon PostgreSQL, Prisma, Paystack & React.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
