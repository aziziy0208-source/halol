import Link from "next/link";
import type { ReactNode } from "react";
import type { SimplePage as SimplePageData } from "@/content/schema";
import { contentFor } from "@/content";
import { type SiteLang, SITE_PAGES, type SitePage } from "@/i18n/site";
import { Footer } from "./footer";
import { Header } from "./header";
import { HtmlLang } from "./html-lang";
import { Container, MessageBlock, TitleBar } from "./layout-primitives";

type FrameProps = {
  lang?: SiteLang;
  /** Page for the language switch; null: no equivalent page (switch goes to the home page). */
  page?: SitePage | null;
  children: ReactNode;
};

/** Sub-page frame: menu bar on top, then title bar, lead sentence and body, footer. */
export function PageFrame({ lang = "de", page = null, children }: FrameProps) {
  const alternates = SITE_PAGES[page ?? "home"];
  return (
    <div lang={lang} className="flex flex-1 flex-col">
      {lang !== "de" ? <HtmlLang lang={lang} /> : null}
      <Header nav={contentFor(lang).site.nav} variant="page" lang={lang} alternates={alternates} />
      <main className="flex-1 pt-6 pb-16">
        <Container>{children}</Container>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

export function SimplePage({ page, lang = "de", pageKey = null }: { page: SimplePageData; lang?: SiteLang; pageKey?: SitePage | null }) {
  return (
    <PageFrame lang={lang} page={pageKey}>
      <TitleBar title={page.title} subtitle={page.subtitle} />
      <MessageBlock text={page.message} />
      {page.paragraphs.map((paragraph, i) => (
        <p key={i} className="mb-[18px]">
          {paragraph}
        </p>
      ))}
      {page.link ? (
        <Link href={page.link.href} className="text-brand-ink underline">
          {page.link.label}
        </Link>
      ) : null}
    </PageFrame>
  );
}
