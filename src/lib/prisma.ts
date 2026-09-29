import { PrismaClient } from "@prisma/client";

// Voorkomt dat elke hot-reload in dev een nieuwe PrismaClient (en dus een
// nieuwe connectie-pool) aanmaakt.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Op Vercel + Neon wijst DATABASE_URL naar de connection pooler; de
// Neon-integratie levert daarnaast POSTGRES_PRISMA_URL (pooler mét
// `pgbouncer=true`, wat Prisma nodig heeft). Lokaal bestaat die niet en
// valt Prisma terug op DATABASE_URL uit schema.prisma. Migraties lopen
// via de directe verbinding (zie `vercel-build` in package.json).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.POSTGRES_PRISMA_URL ? { datasourceUrl: process.env.POSTGRES_PRISMA_URL } : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
