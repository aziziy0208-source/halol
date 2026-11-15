import type { ReactNode } from "react";
import type { ContentSection as ContentSectionData } from "@/content/schema";
import { Rows } from "./blocks";
import { IconCards, StatCards } from "./cards";
import { Container, MessageBlock, TitleBar } from "./layout-primitives";
import { Parallax } from "./parallax";

type Props = {
  section: ContentSectionData;
  /** Render without the leading parallax band (e.g. when placed elsewhere). */
  withParallax?: boolean;
  /** Extra content rendered above the title (the About slider). */
  before?: ReactNode;
};

export function ContentSection({ section, withParallax = true, before }: Props) {
  return (
    <>
      {withParallax && section.parallax ? (
        <Parallax image={section.parallax.image} text={section.parallax.text} />
      ) : null}
      <section id={section.id} className="pb-16">
        {before}
        <Container className="pt-6">
          <TitleBar title={section.title} subtitle={section.subtitle} />
          <MessageBlock text={section.message} />
          {section.cards ? <IconCards cards={section.cards} /> : null}
          {section.stats ? <StatCards stats={section.stats} /> : null}
          <Rows rows={section.rows} />
        </Container>
      </section>
    </>
  );
}
