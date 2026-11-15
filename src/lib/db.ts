import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";
import { createPrismaClient } from "@/lib/prisma-client";

// One client per process; reused across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient(serverEnv().DATABASE_URL);
  return globalForPrisma.prisma;
}

/** Lazily connected Prisma client (created on first property access). */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
