import React, { useState } from 'react';
import { Ticket, EventItem } from '../types/index.ts';
import { QrCodeSvg } from '../utils/qr.tsx';
import { downloadTicketPdf } from '../utils/pdf.ts';
import { LocationIcon, DownloadIcon, CopyIcon, CheckIcon } from './Icons.tsx';

interface TicketItemProps {
  ticket: Ticket;
  index: number;
  event?: EventItem;
  buyerEmail?: string;
  orderRef?: string;
}

export const TicketItem: React.FC<TicketItemProps> = ({
  ticket,
  index,
  event,
  buyerEmail,
  orderRef,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(ticket.ticketCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    try {
      setDownloading(true);
      const dateFormatted = event?.date
        ? new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Date TBD';

      downloadTicketPdf({
        eventTitle: event?.title || 'Live Event',
        venue: event?.venue || 'Venue TBD',
        dateStr: dateFormatted,
        buyerEmail: buyerEmail || 'Verified Attendee',
        orderRef: orderRef || 'OFFICIAL_ORDER',
        ticketCode: ticket.ticketCode,
      });
    } catch (e) {
      console.error('Error downloading ticket PDF:', e);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  }

  return (
    <div className="ticket-card-expanded">
      {/* Left / Info Side */}
      <div className="ticket-info-side">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span className="badge badge-paid">
            Ticket #{index + 1}
          </span>
        </div>

        <div className="ticket-code-display" style={{ marginBottom: '1rem' }}>
          <span className="ticket-code-text">{ticket.ticketCode}</span>
          <button onClick={handleCopy} className="copy-btn" title="Copy Ticket Code" aria-label="Copy ticket code">
            {copied ? (
              <>
                <CheckIcon size={13} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          {event && (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {event.title}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <LocationIcon size={14} className="card-info-icon" />
                <span>{event.venue}</span>
              </div>
            </>
          )}
          {orderRef && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
              Order: {orderRef}
            </div>
          )}
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn btn-secondary download-pdf-btn"
        >
          <DownloadIcon size={16} />
          <span>{downloading ? 'Generating PDF...' : 'Download PDF Ticket'}</span>
        </button>
      </div>

      {/* Right / QR Code Side */}
      <div className="ticket-qr-side">
        <div className="qr-wrapper">
          <QrCodeSvg value={ticket.ticketCode} size={130} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
          Scan at entrance
        </span>
      </div>
    </div>
  );
};
