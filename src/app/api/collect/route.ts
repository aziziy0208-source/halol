import { after } from "next/server";
import { type BeaconPayload, recordPageView } from "@/lib/analytics/record";

const MAX_BODY = 2048;

/**
 * Page-view beacon of the public site (first-party statistics, no cookies). Always
 * answers 204 at once; the row is written after the response.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let payload: BeaconPayload;
  try {
    payload = JSON.parse(text) as BeaconPayload;
  } catch {
    return new Response(null, { status: 400 });
  }
  const headers = new Headers(request.headers);
  after(async () => {
    try {
      await recordPageView(payload, headers);
    } catch (error) {
      console.error("[collect] page view not stored", error);
    }
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
