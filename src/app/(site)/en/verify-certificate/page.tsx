import type { Metadata } from "next";
import { PageFrame } from "@/components/site/simple-page";
import { languageAlternates } from "@/i18n/site";
import { ManualCheckView } from "../../zertifikat-pruefen/check-view";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description: "Check the authenticity and status of a WHU halal certificate – by QR code or certificate number.",
  alternates: { canonical: "/en/verify-certificate", languages: languageAlternates("check") },
  openGraph: { locale: "en_GB" },
};

export default function VerifyCertificatePage() {
  return (
    <PageFrame lang="en" page="check">
      <ManualCheckView lang="en" />
    </PageFrame>
  );
}
