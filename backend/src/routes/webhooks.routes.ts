import { Router, Request, Response, NextFunction } from 'express';
import { paystackService } from '../services/paystack.service.js';
import { webhookService } from '../services/webhook.service.js';

const router = Router();

router.post('/paystack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody;

    // STEP 1: Strict signature verification against raw request body BEFORE anything else
    if (!signature || !rawBody) {
      res.status(401).json({ error: 'Unauthorized: Missing signature or body' });
      return;
    }

    const isValid = paystackService.verifySignature(rawBody, signature as string);
    if (!isValid) {
      res.status(401).json({ error: 'Unauthorized: Invalid signature' });
      return;
    }

    // STEP 2: Idempotent processing of the verified event
    const result = await webhookService.processPaystackEvent(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export const webhookRoutes = router;
