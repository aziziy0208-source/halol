import { contentFor } from "@/content";
import type { SiteLang } from "@/i18n/site";
import { Divider, MessageBlock, TitleBar } from "./layout-primitives";
import { PageFrame } from "./simple-page";

function Lines({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null; // e.g. "Aufsichtsbehörde" until WHU supplies it
  return (
    <div className="mb-[18px]">
      <h3 className="mb-1.5 font-sans text-sm font-semibold text-[#333]">{heading}</h3>
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </div>
  );
}

export function ImpressumView({ lang }: { lang: SiteLang }) {
  const i = contentFor(lang).impressum;
  return (
    <PageFrame lang={lang} page="impressum">
      <TitleBar title={i.title} subtitle={[]} />
      <MessageBlock text={i.message} />
      <div className="grid gap-x-5 md:grid-cols-2">
        <div>
          <Lines heading={i.provider.heading} lines={i.provider.lines} />
          <Lines heading={i.contact.heading} lines={i.contact.lines} />
          <p className="mb-[18px]">
            <span className="block">{i.contact.phone}</span>
            <span className="block">{i.contact.fax}</span>
            <a href={`mailto:${i.contact.email}`} className="text-brand-ink hover:underline">
              {i.contact.email}
            </a>
          </p>
        </div>
        <div>
          <Lines heading={i.register.heading} lines={i.register.lines} />
          <Lines heading={i.tax.heading} lines={i.tax.lines} />
          <Lines heading={i.authority.heading} lines={i.authority.lines} />
        </div>
      </div>
      <Divider />
      <h2 className="mb-[18px] text-2xl">{i.disclaimer.heading}</h2>
      {i.disclaimer.sections.map((section) => (
        <div key={section.heading} className="mb-6 max-w-3xl">
          <h3 className="mb-2 text-xl">{section.heading}</h3>
          {section.text.map((paragraph, n) => (
            <p key={n} className="mb-[18px]">
              {paragraph}
            </p>
          ))}
        </div>
      ))}
    </PageFrame>
  );
}
