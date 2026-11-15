import { connection } from "next/server";
import { prisma } from "@/lib/db";

// Used by the Docker healthcheck and uptime monitoring.
export async function GET() {
  await connection(); // never prerender: must hit the database per request
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
