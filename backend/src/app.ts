import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { adminRoutes } from './routes/admin.routes.js';
import { eventRoutes } from './routes/events.routes.js';
import { orderRoutes } from './routes/orders.routes.js';
import { webhookRoutes } from './routes/webhooks.routes.js';
import { ticketRoutes } from './routes/tickets.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Extend Express Request to hold rawBody Buffer
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function createApp(): Express {
  const app = express();

  // Enable CORS
  app.use(cors());

  // Capture raw body for webhook HMAC signature verification while parsing JSON
  app.use(
    express.json({
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      },
    })
  );

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Webhooks (both /webhooks/paystack and /api/webhooks/paystack supported)
  app.use('/webhooks', webhookRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Mount API routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/orders', orderRoutes); // Support GET /orders/:reference directly

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
