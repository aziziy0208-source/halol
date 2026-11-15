import type { Metadata } from "next";
import { content } from "@/content";
import { Footer } from "@/components/site/footer";
import { SimplePage } from "@/components/site/simple-page";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <SimplePage page={content.pages.notFound} />
      <Footer />
    </>
  );
}
