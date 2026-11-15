import { Router, Request, Response, NextFunction } from 'express';
import { requireAdminAuth } from '../middleware/auth.js';
import { eventService } from '../services/event.service.js';

const router = Router();

// Protect all admin routes with requireAdminAuth
router.use(requireAdminAuth);

router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, date, venue, price, capacity } = req.body;
    const event = await eventService.createEvent({
      title,
      date,
      venue,
      price: Number(price),
      capacity: Number(capacity),
    });
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await eventService.listEvents(true);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

export const adminRoutes = router;
