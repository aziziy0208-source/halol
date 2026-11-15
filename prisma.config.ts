import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI only (migrate, seed): a direct connection where the host provides one —
    // Neon/Vercel set DATABASE_URL to a pooled URL, which migrations should not use.
    url: process.env["DATABASE_URL_UNPOOLED"] || process.env["POSTGRES_URL_NON_POOLING"] || process.env["DATABASE_URL"],
  },
});
