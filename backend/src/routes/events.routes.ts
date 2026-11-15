import { Router, Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await eventService.listEvents(false);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    res.json(event);
  } catch (error) {
    next(error);
  }
});

export const eventRoutes = router;
