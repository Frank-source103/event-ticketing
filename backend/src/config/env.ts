import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory or parent directory
dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  databaseUrl: process.env.DATABASE_URL || '',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  adminApiKey: process.env.ADMIN_API_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export function validateRequiredEnv(keys: Array<keyof typeof config>) {
  for (const key of keys) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
