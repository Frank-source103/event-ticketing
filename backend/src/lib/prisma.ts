import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Clean DATABASE_URL if quotes were accidentally passed in environment
const rawUrl = process.env.DATABASE_URL || '';
const cleanUrl = rawUrl.replace(/^["']|["']$/g, '').trim();

if (cleanUrl) {
  process.env.DATABASE_URL = cleanUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: cleanUrl ? { db: { url: cleanUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
