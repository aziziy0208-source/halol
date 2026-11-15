import Link from "next/link";
import type { ReactNode } from "react";
import type { SimplePage as SimplePageData } from "@/content/schema";
import { content } from "@/content";
import { Header } from "./header";
import { Container, MessageBlock, TitleBar } from "./layout-primitives";

/** Sub-page frame: menu bar on top, then title bar, lead sentence and body. */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Header nav={content.site.nav} variant="page" />
      <main className="flex-1 pt-6 pb-16">
        <Container>{children}</Container>
      </main>
    </>
  );
}

export function SimplePage({ page }: { page: SimplePageData }) {
  return (
    <PageFrame>
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
