import { createVerifyChallenge } from "@/lib/verify/altcha";
import { withinLimit } from "@/lib/verify/requests";

/** ALTCHA challenge for the manual certificate check (fetched by the widget). */
export async function GET(request: Request) {
  if (!(await withinLimit("challenge", request.headers))) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(await createVerifyChallenge(), { headers: { "Cache-Control": "no-store" } });
}
