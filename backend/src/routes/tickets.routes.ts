import { Router, Request, Response, NextFunction } from 'express';
import { requireAdminAuth } from '../middleware/auth.js';
import { checkInService } from '../services/checkin.service.js';

const router = Router();

/**
 * POST /api/tickets/check-in
 * Check in an attendee at the gate (requires x-admin-key)
 */
router.post('/check-in', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketCode } = req.body;
    if (!ticketCode || typeof ticketCode !== 'string') {
      res.status(400).json({ error: 'Missing or invalid ticketCode' });
      return;
    }

    const result = await checkInService.checkInTicket(ticketCode);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        error: error.message,
        ...(error.data || {}),
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/tickets/verify/:ticketCode
 * Preview ticket validity before admission (requires x-admin-key)
 */
router.get('/verify/:ticketCode', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketCode } = req.params;
    const status = await checkInService.getTicketStatus(ticketCode);
    res.status(200).json(status);
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/tickets/stats/:eventId
 * Real-time gate stats for an event (requires x-admin-key)
 */
router.get('/stats/:eventId', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const stats = await checkInService.getGateStats(eventId);
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
});

export const ticketRoutes = router;
