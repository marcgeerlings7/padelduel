import { PrismaClient } from "@prisma/client";

// Voorkomt dat elke hot-reload in dev een nieuwe PrismaClient (en dus een
// nieuwe connectie-pool) aanmaakt.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
