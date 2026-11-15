import type { SurenSection as SurenSectionData } from "@/content/schema";
import { Container, Divider, MessageBlock, TitleBar } from "./layout-primitives";
import { RichText } from "./rich-text";

/** Qur'an verses on halal: Arabic original (right-to-left) next to the German translation. */
export function SurenSection({ section }: { section: SurenSectionData }) {
  return (
    <section id={section.id} className="pb-16">
      <Container>
        <Divider />
        <TitleBar title={section.title} subtitle={section.subtitle} />
        <MessageBlock text={section.message} />
        <div className="space-y-8 md:space-y-4">
          {section.verses.map((verse, i) => (
            <div key={i} className="grid gap-x-5 gap-y-2 md:grid-cols-2">
              <div>
                <h3 lang="tr" className="mb-2 text-base">
                  <RichText text={verse.arabicLabel} />
                </h3>
                <p lang="ar" dir="rtl" className="mb-[18px] font-arabic text-[22px] leading-[2.1] text-[#333]">
                  {verse.arabic}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-base">
                  <RichText text={verse.label} />
                </h3>
                <p className="mb-[18px]">{verse.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
