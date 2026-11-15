import React from 'react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  return (
    <nav className="navbar" aria-label="Main Navigation">
      <div className="container nav-container">
        <a 
          href="#/" 
          onClick={(e) => { e.preventDefault(); onNavigate('/'); }}
          className="brand"
        >
          <div className="brand-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
          </div>
          <span>EventPass</span>
        </a>

        <div className="nav-links">
          <a
            href="#/"
            onClick={(e) => { e.preventDefault(); onNavigate('/'); }}
            className={`nav-link ${currentPath === '/' ? 'active' : ''}`}
          >
            Explore Events
          </a>
          <a
            href="#/my-tickets"
            onClick={(e) => { e.preventDefault(); onNavigate('/my-tickets'); }}
            className={`nav-link ${currentPath === '/my-tickets' ? 'active' : ''}`}
          >
            My Tickets
          </a>
          <a
            href="#/check-in"
            onClick={(e) => { e.preventDefault(); onNavigate('/check-in'); }}
            className={`nav-link ${currentPath === '/check-in' ? 'active' : ''}`}
          >
            <span>Gate Scanner</span>
            <span className="nav-tag">Staff</span>
          </a>
        </div>
      </div>
    </nav>
  );
};
