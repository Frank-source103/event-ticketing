import React from 'react';
import { QrCode } from './qrcodegen.ts';

export interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Returns a 2D boolean array representing the QR code matrix (true = dark, false = light).
 */
export function getQrMatrix(text: string): boolean[][] {
  try {
    const qr = QrCode.encodeText(text, QrCode.Ecc.MEDIUM);
    const matrix: boolean[][] = [];
    for (let r = 0; r < qr.size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < qr.size; c++) {
        row.push(qr.getModule(c, r));
      }
      matrix.push(row);
    }
    return matrix;
  } catch (e) {
    console.error('Failed to generate QR matrix:', e);
    return [];
  }
}

/**
 * Responsive React SVG component for rendering crisp, scannable QR codes.
 */
export const QrCodeSvg: React.FC<QrCodeProps> = ({ value, size = 160, className = '' }) => {
  const matrix = getQrMatrix(value);
  const border = 2; // Quiet zone
  const matrixSize = matrix.length;
  const totalDim = matrixSize + border * 2;

  if (matrixSize === 0) {
    return <div style={{ width: size, height: size, background: 'var(--slate-850)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>Invalid QR</div>;
  }

  // Build SVG path for dark modules
  let path = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        path += `M${c + border},${r + border}h1v1h-1z `;
      }
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalDim} ${totalDim}`}
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: '6px',
        background: '#ffffff',
        display: 'block',
      }}
      aria-label={`QR Code for ticket ${value}`}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path fill="#090d16" d={path} />
    </svg>
  );
};
