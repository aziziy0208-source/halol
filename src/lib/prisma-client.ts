import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Builds a Prisma client on the node-postgres driver adapter (Prisma 7).
 * DATABASE_POOL_MAX caps the connection pool (pg's default is 10); set it to 1
 * for single-connection databases such as the PGlite-based `prisma dev` server.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString, ...(max ? { max } : {}) });
  return new PrismaClient({ adapter });
}
