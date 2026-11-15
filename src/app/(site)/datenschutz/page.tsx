import type { Metadata } from "next";
import { content } from "@/content";
import { SimplePage } from "@/components/site/simple-page";

// Placeholder until WHU provides the Datenschutzerklärung — keep out of search results meanwhile.
export const metadata: Metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  return <SimplePage page={content.pages.datenschutz} />;
}
