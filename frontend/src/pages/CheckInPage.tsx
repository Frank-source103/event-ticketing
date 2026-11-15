import React, { useState, useRef, useEffect } from 'react';
import { checkInTicket, validateAdminKey, CheckInResponse } from '../api/client.ts';
import { LockIcon, CheckIcon, AlertCircleIcon, QrIcon } from '../components/Icons.tsx';

interface ScanHistoryItem {
  id: string;
  code: string;
  status: 'success' | 'duplicate' | 'error';
  message: string;
  attendee?: string;
  timestamp: string;
}

export const CheckInPage: React.FC = () => {
  // Session-based authentication state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return !!sessionStorage.getItem('staff_gate_key');
  });
  const [adminKey, setAdminKey] = useState<string>(() => {
    return sessionStorage.getItem('staff_gate_key') || '';
  });

  // Lockscreen form state
  const [keyInput, setKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Active scanner state
  const [ticketCodeInput, setTicketCodeInput] = useState<string>('');
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    type: 'success' | 'duplicate' | 'error';
    title: string;
    message: string;
    attendee?: string;
    eventTitle?: string;
    time?: string;
  } | null>(null);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const lockInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isUnlocked && scannerInputRef.current) {
      scannerInputRef.current.focus();
    } else if (!isUnlocked && lockInputRef.current) {
      lockInputRef.current.focus();
    }
  }, [isUnlocked, result]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const candidate = keyInput.trim();
    if (!candidate) return;

    try {
      setUnlockLoading(true);
      setUnlockError(null);

      const isValid = await validateAdminKey(candidate);
      if (!isValid) {
        setUnlockError('Invalid authorization key. Access denied.');
        return;
      }

      // Store in session storage (cleared when browser tab closes)
      sessionStorage.setItem('staff_gate_key', candidate);
      setAdminKey(candidate);
      setIsUnlocked(true);
      setKeyInput('');
    } catch {
      setUnlockError('Unable to connect to authorization server.');
    } finally {
      setUnlockLoading(false);
    }
  }

  function handleLockTerminal() {
    sessionStorage.removeItem('staff_gate_key');
    setAdminKey('');
    setIsUnlocked(false);
    setResult(null);
  }

  function handleAutofillTestKey() {
    setKeyInput('test_admin_secret_key_2026');
    setUnlockError(null);
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    const code = ticketCodeInput.trim();
    if (!code) return;

    try {
      setScanLoading(true);
      setResult(null);

      const res: CheckInResponse = await checkInTicket(code, adminKey);

      const successData = {
        type: 'success' as const,
        title: 'VALID ADMISSION',
        message: 'Attendee admitted successfully. Ticket checked in.',
        attendee: res.ticket?.buyerEmail,
        eventTitle: res.ticket?.eventTitle,
        time: res.ticket?.checkedInAt
          ? new Date(res.ticket.checkedInAt).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
      };

      setResult(successData);

      setHistory((prev) => [
        {
          id: `${Date.now()}_${Math.random()}`,
          code,
          status: 'success',
          message: 'Admitted',
          attendee: res.ticket?.buyerEmail,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);

      setTicketCodeInput('');
    } catch (err: any) {
      const isDuplicate = err.status === 409 || err.message?.toLowerCase().includes('already used');
      const errorData = {
        type: isDuplicate ? ('duplicate' as const) : ('error' as const),
        title: isDuplicate ? 'ENTRY DENIED: ALREADY USED' : 'INVALID TICKET',
        message: err.message || 'Ticket could not be validated.',
        attendee: err.data?.buyerEmail,
        time: err.data?.checkedInAt
          ? new Date(err.data.checkedInAt).toLocaleTimeString()
          : undefined,
      };

      setResult(errorData);

      setHistory((prev) => [
        {
          id: `${Date.now()}_${Math.random()}`,
          code,
          status: isDuplicate ? 'duplicate' : 'error',
          message: isDuplicate ? 'Already Scanned' : 'Invalid',
          attendee: err.data?.buyerEmail,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);

      setTicketCodeInput('');
    } finally {
      setScanLoading(false);
      scannerInputRef.current?.focus();
    }
  }

  // ==========================================
  // VIEW 1: LOCKED SCREEN (Gate Lockscreen)
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="container" style={{ padding: '4rem 1.25rem 6rem' }}>
        <div
          style={{
            maxWidth: 440,
            margin: '0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              background: 'var(--slate-850)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <LockIcon size={24} />
          </div>

          <span
            className="nav-tag"
            style={{ marginBottom: '0.75rem', display: 'inline-block' }}
          >
            Staff Gate Terminal
          </span>

          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Terminal Locked
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.75rem', lineHeight: '1.5' }}>
            Authenticate with your organizer key to access turnstile check-in and ticket verification.
          </p>

          {unlockError && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: '1.25rem',
                fontSize: '0.8125rem',
                textAlign: 'left',
              }}
            >
              <AlertCircleIcon size={16} />
              <div>{unlockError}</div>
            </div>
          )}

          <form onSubmit={handleUnlock}>
            <div style={{ position: 'relative', marginBottom: '1.25rem', textAlign: 'left' }}>
              <label
                htmlFor="staffKeyInput"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '0.35rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Staff Authorization Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="staffKeyInput"
                  ref={lockInputRef}
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    if (unlockError) setUnlockError(null);
                  }}
                  placeholder="Enter authorization key..."
                  className="form-input"
                  style={{
                    width: '100%',
                    paddingRight: '3.75rem',
                    fontFamily: showKey ? 'var(--font-mono)' : 'inherit',
                  }}
                  disabled={unlockLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 6px',
                  }}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={unlockLoading || !keyInput.trim()}
              className="btn btn-primary btn-block"
            >
              {unlockLoading ? 'Authenticating...' : 'Unlock Gate Terminal'}
            </button>
          </form>

          {/* Quick Local Test Helper */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border)',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Testing locally? </span>
            <button
              type="button"
              onClick={handleAutofillTestKey}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: 600,
                fontSize: '0.8125rem',
              }}
            >
              Autofill test key
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: UNLOCKED GATE SCANNER TERMINAL
  // ==========================================
  return (
    <div className="container" style={{ padding: '2.5rem 1rem 5rem' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        {/* Terminal Status Bar with Lock Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>
              Gate Terminal Authorized
            </span>
          </div>

          <button
            onClick={handleLockTerminal}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8125rem',
              minHeight: '34px',
              padding: '0 0.75rem',
            }}
          >
            <LockIcon size={13} />
            <span>Lock Terminal</span>
          </button>
        </div>

        {/* Page Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Gate Turnstile Scanner
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Admit attendees and verify ticket validity in real time.
          </p>
        </div>

        {/* Scanner / Code Entry Box */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            marginBottom: '1.75rem',
          }}
        >
          <label
            htmlFor="ticketCodeInput"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.6rem',
              fontWeight: 600,
            }}
          >
            Scan QR Code or Type Admission Code:
          </label>
          <form onSubmit={handleCheckIn} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              id="ticketCodeInput"
              ref={scannerInputRef}
              type="text"
              value={ticketCodeInput}
              onChange={(e) => setTicketCodeInput(e.target.value)}
              placeholder="e.g. TKT-6F7CF0-FA38A9"
              className="form-input"
              style={{
                fontSize: '1.1rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                flex: 1,
              }}
              disabled={scanLoading}
              autoComplete="off"
              autoFocus
            />
            <button
              type="submit"
              disabled={scanLoading || !ticketCodeInput.trim()}
              className="btn btn-primary"
            >
              {scanLoading ? 'Verifying...' : 'Admit Attendee'}
            </button>
          </form>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
            Tip: Compatible with handheld USB/Bluetooth 2D barcode scanners (auto-submits on enter).
          </div>
        </div>

        {/* Gate Scan Result Banner */}
        {result && (
          <div
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '1.75rem',
              border: `1px solid ${
                result.type === 'success'
                  ? 'var(--success-border)'
                  : result.type === 'duplicate'
                  ? 'var(--danger-border)'
                  : 'var(--warning-border)'
              }`,
              background:
                result.type === 'success'
                  ? 'var(--success-bg)'
                  : result.type === 'duplicate'
                  ? 'var(--danger-bg)'
                  : 'var(--warning-bg)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              {result.type === 'success' ? (
                <div style={{ color: 'var(--success)' }}>
                  <CheckIcon size={32} />
                </div>
              ) : (
                <div style={{ color: result.type === 'duplicate' ? 'var(--danger)' : 'var(--warning)' }}>
                  <AlertCircleIcon size={32} />
                </div>
              )}
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color:
                  result.type === 'success'
                    ? 'var(--success)'
                    : result.type === 'duplicate'
                    ? 'var(--danger)'
                    : 'var(--warning)',
                marginBottom: '0.35rem',
              }}
            >
              {result.title}
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              {result.message}
            </p>

            {(result.attendee || result.eventTitle || result.time) && (
              <div
                style={{
                  background: 'var(--slate-950)',
                  border: '1px solid var(--border)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-block',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  lineHeight: '1.6',
                }}
              >
                {result.attendee && <div><span style={{ color: 'var(--text-muted)' }}>Attendee:</span> {result.attendee}</div>}
                {result.eventTitle && <div><span style={{ color: 'var(--text-muted)' }}>Event:</span> {result.eventTitle}</div>}
                {result.time && <div><span style={{ color: 'var(--text-muted)' }}>Timestamp:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{result.time}</span></div>}
              </div>
            )}
          </div>
        )}

        {/* Live Gate Session Activity Log */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              Recent Gate Admissions ({history.filter((h) => h.status === 'success').length} Admitted)
            </h3>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', minHeight: '30px', padding: '0 0.5rem' }}
              >
                Clear Log
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
              No tickets scanned yet this session. Scanned codes will appear here in real time.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.85rem',
                    background: 'var(--slate-850)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <code style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{item.code}</code>
                    {item.attendee && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        ({item.attendee})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color:
                          item.status === 'success'
                            ? 'var(--success)'
                            : item.status === 'duplicate'
                            ? 'var(--danger)'
                            : 'var(--warning)',
                      }}
                    >
                      {item.message}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
