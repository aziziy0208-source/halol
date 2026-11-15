import type { Metadata } from "next";
import { headers } from "next/headers";
import { after, connection } from "next/server";
import { Suspense } from "react";
import {
  VerificationLoading,
  VerificationNotFound,
  VerificationRateLimited,
  VerificationResult,
  VerifyFrame,
} from "@/components/verify/verification";
import { pickVerifyLang } from "@/i18n/verify";
import { findPublicByToken } from "@/lib/verify/lookup";
import { recordScan, withinLimit } from "@/lib/verify/requests";

// Verification pages never appear in search engines (spec §8.2); see also the X-Robots-Tag header.
export const metadata: Metadata = {
  title: "Zertifikatsprüfung · Certificate verification",
  description: "Live-Status eines Halal-Zertifikats der WHU – World Halal Union. Live status of a WHU halal certificate.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function VerifyPage(props: PageProps<"/v/[token]">) {
  return (
    <Suspense fallback={<VerificationLoading />}>
      <Verification {...props} />
    </Suspense>
  );
}

async function Verification({ params, searchParams }: PageProps<"/v/[token]">) {
  // Request time only: rate limiting, the live status, the check time and the scan log
  // must never run in a (runtime) prerender — that would count every visit twice.
  await connection();
  const [{ token }, sp, h] = await Promise.all([params, searchParams, headers()]);
  const lang = pickVerifyLang(first(sp.lang), h.get("accept-language"));
  const switchHref = `/v/${encodeURIComponent(token)}?lang=${lang === "de" ? "en" : "de"}`;
  const checkedAt = new Date();

  if (!(await withinLimit("page", h))) {
    return (
      <VerifyFrame lang={lang} switchHref={switchHref}>
        <VerificationRateLimited lang={lang} />
      </VerifyFrame>
    );
  }

  const cert = await findPublicByToken(token);
  if (cert) {
    const channel = first(sp.via) === "manual" ? "MANUAL" : "QR";
    // Logged after the response is sent: the visitor never waits for the scan log.
    after(() => recordScan(cert.id, channel, h).catch((error) => console.error("scan log failed", error)));
  }

  return (
    <VerifyFrame lang={lang} switchHref={switchHref}>
      {cert ? (
        <VerificationResult cert={cert} lang={lang} checkedAt={checkedAt} />
      ) : (
        <VerificationNotFound lang={lang} checkedAt={checkedAt} />
      )}
    </VerifyFrame>
  );
}
