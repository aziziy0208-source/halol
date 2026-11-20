import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { prunePageViews } from "@/lib/analytics/record";
import { inboxConfigured } from "@/lib/inbox/resend";
import { syncInbox } from "@/lib/inbox/sync";

export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, vercel.json): copies new mail even if nobody opens the mailbox,
 * and deletes statistics older than 25 months.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 32 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Not found", { status: 404 });
  }
  const prunedPageViews = await prunePageViews().catch((error) => {
    console.error("[cron] statistics retention failed", error);
    return -1;
  });
  if (!inboxConfigured()) return Response.json({ status: "not-configured", prunedPageViews });
  try {
    return Response.json({ status: "ok", ...(await syncInbox(null)), prunedPageViews });
  } catch (error) {
    console.error("[cron] inbox sync failed", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
