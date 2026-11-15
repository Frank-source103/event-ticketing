import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.headers['x-admin-key'] || req.headers['admin_api_key'];
  const expectedKey = config.adminApiKey || process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    res.status(500).json({ error: 'Server misconfigured: ADMIN_API_KEY is not set' });
    return;
  }

  if (!adminKey || adminKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing Admin API key' });
    return;
  }

  next();
}
