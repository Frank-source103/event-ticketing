import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service.js';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, buyerEmail, quantity, callbackUrl } = req.body;
    const result = await orderService.createOrder({
      eventId,
      buyerEmail,
      quantity: Number(quantity),
      callbackUrl,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:reference', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderByReference(req.params.reference);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export const orderRoutes = router;
