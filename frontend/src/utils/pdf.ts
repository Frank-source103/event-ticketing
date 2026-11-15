import { QrCode } from './qrcodegen.ts';

export interface TicketPdfData {
  eventTitle: string;
  venue: string;
  dateStr: string;
  buyerEmail: string;
  orderRef: string;
  ticketCode: string;
}

/**
 * Generates a clean, vector-based PDF ticket with embedded QR code
 * and triggers immediate client-side download with zero external dependencies.
 */
export function downloadTicketPdf(data: TicketPdfData): void {
  const width = 640;
  const height = 360;

  // Generate QR code matrix
  const qr = QrCode.encodeText(data.ticketCode, QrCode.Ecc.MEDIUM);

  // Helper to escape PDF literal string special chars
  const esc = (s: string) =>
    (s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  let stream = '';

  // Background Ticket Card (#0b1329)
  stream += `0.05 0.08 0.16 rg\n`;
  stream += `20 20 600 320 re f\n`;

  // Ticket Outer Border (#1e293b)
  stream += `0.20 0.25 0.38 RG 1.5 w\n`;
  stream += `20 20 600 320 re s\n`;

  // Top Indigo Header Banner (#4f46e5)
  stream += `0.31 0.27 0.90 rg\n`;
  stream += `20 295 600 45 re f\n`;

  // Brand / Header Title
  stream += `BT\n/F1 16 Tf\n1 1 1 rg\n40 312 Td\n(EVENTPASS ADMISSION TICKET) Tj\nET\n`;

  // Verified Badge
  stream += `0.05 0.45 0.25 rg\n`;
  stream += `485 305 115 24 re f\n`;
  stream += `BT\n/F1 10 Tf\n1 1 1 rg\n502 313 Td\n(OFFICIAL PASS) Tj\nET\n`;

  // Event Title
  stream += `BT\n/F1 20 Tf\n1 1 1 rg\n40 255 Td\n(${esc(data.eventTitle)}) Tj\nET\n`;

  // Date & Time
  stream += `BT\n/F2 10 Tf\n0.58 0.64 0.72 rg\n40 228 Td\n(DATE & TIME) Tj\nET\n`;
  stream += `BT\n/F1 13 Tf\n0.94 0.96 0.98 rg\n40 212 Td\n(${esc(data.dateStr)}) Tj\nET\n`;

  // Venue
  stream += `BT\n/F2 10 Tf\n0.58 0.64 0.72 rg\n40 182 Td\n(VENUE) Tj\nET\n`;
  stream += `BT\n/F1 13 Tf\n0.94 0.96 0.98 rg\n40 166 Td\n(${esc(data.venue)}) Tj\nET\n`;

  // Attendee Email
  stream += `BT\n/F2 10 Tf\n0.58 0.64 0.72 rg\n40 136 Td\n(ATTENDEE EMAIL) Tj\nET\n`;
  stream += `BT\n/F2 12 Tf\n0.94 0.96 0.98 rg\n40 120 Td\n(${esc(data.buyerEmail)}) Tj\nET\n`;

  // Order Reference
  stream += `BT\n/F2 10 Tf\n0.58 0.64 0.72 rg\n40 92 Td\n(ORDER REFERENCE) Tj\nET\n`;
  stream += `BT\n/F2 11 Tf\n0.94 0.96 0.98 rg\n40 76 Td\n(${esc(data.orderRef)}) Tj\nET\n`;

  // Ticket Code Badge in left col
  stream += `0.12 0.16 0.27 rg\n`;
  stream += `40 32 300 30 re f\n`;
  stream += `0.25 0.32 0.48 RG 1 w\n`;
  stream += `40 32 300 30 re s\n`;

  stream += `BT\n/F1 12 Tf\n0.50 0.75 1.0 rg\n52 42 Td\n(CODE: ${esc(data.ticketCode)}) Tj\nET\n`;

  // Vertical Dashed Divider between details and QR section
  stream += `q [4 4] 0 d 0.28 0.34 0.45 RG 1 w\n`;
  stream += `365 30 m 365 285 l S Q\n`;

  // Right column: QR Code Container
  const qrBoxX = 395;
  const qrBoxY = 65;
  const qrBoxSize = 200;

  // White background for QR code
  stream += `1 1 1 rg\n`;
  stream += `${qrBoxX} ${qrBoxY} ${qrBoxSize} ${qrBoxSize} re f\n`;

  // Draw QR Modules as vector squares
  const padding = 16;
  const avail = qrBoxSize - padding * 2;
  const cellSize = avail / qr.size;

  stream += `0 0 0 rg\n`;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.getModule(c, r)) {
        const modX = qrBoxX + padding + c * cellSize;
        const modY = qrBoxY + padding + (qr.size - 1 - r) * cellSize;
        stream += `${modX.toFixed(2)} ${modY.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f\n`;
      }
    }
  }

  // Scan instruction below QR code
  stream += `BT\n/F1 10 Tf\n0.70 0.76 0.85 rg\n440 42 Td\n(SCAN FOR GATE ENTRY) Tj\nET\n`;

  // Assemble full PDF structure
  const streamBytes = new TextEncoder().encode(stream);
  const streamLength = streamBytes.length;

  let body = `%PDF-1.4\n`;
  const offsets: number[] = [0];

  const encoder = new TextEncoder();
  const getByteLength = (str: string) => encoder.encode(str).length;

  offsets.push(getByteLength(body));
  body += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

  offsets.push(getByteLength(body));
  body += `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;

  offsets.push(getByteLength(body));
  body += `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`;

  offsets.push(getByteLength(body));
  body += `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  offsets.push(getByteLength(body));
  body += `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  offsets.push(getByteLength(body));
  body += `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`;

  const xrefOffset = getByteLength(body);
  body += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    const pad = String(offsets[i]).padStart(10, '0');
    body += `${pad} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Create Blob and trigger download
  const blob = new Blob([new TextEncoder().encode(body)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ticket-${data.ticketCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
