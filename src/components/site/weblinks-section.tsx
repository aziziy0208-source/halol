import Image from "next/image";
import type { WeblinksSection as WeblinksSectionData } from "@/content/schema";
import { Container, Divider, MessageBlock } from "./layout-primitives";
import { Parallax } from "./parallax";

/** Membership and standard-setter logos, each linking to the organisation's site. */
export function WeblinksSection({ section }: { section: WeblinksSectionData }) {
  return (
    <>
      {section.parallax ? <Parallax image={section.parallax.image} text={section.parallax.text} /> : null}
      <section id={section.id} className="pt-6 pb-16">
        <Container>
          {/* Long subtitle: stacks under the title on mobile instead of squeezing beside it. */}
          <div className="my-[18px] flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-[6px]">
            <h2 className="shrink-0 text-[32px] leading-[40px] text-[#333] sm:border-r-4 sm:border-brand sm:pr-[6px] sm:text-[40px] sm:leading-[44px]">
              {section.title}
            </h2>
            <p className="m-0 border-l-4 border-brand pl-2 text-sm leading-[18px] sm:border-0 sm:pt-1 sm:pl-0">
              {section.subtitle.join(" ")}
            </p>
          </div>
          <MessageBlock text={section.message} />
          {section.groups.map((group, g) => (
            <div key={group.heading}>
              {g > 0 ? <Divider /> : null}
              <h3 className="mt-[18px] mb-[18px] text-xl">{group.heading}</h3>
              <ul className="grid grid-cols-2 gap-5 md:grid-cols-4">
                {group.items.map((item) => (
                  <li key={item.href} className="text-center">
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="group block">
                      <Image
                        src={item.image}
                        alt={item.label}
                        width={320}
                        height={230}
                        sizes="(min-width: 768px) 220px, 45vw"
                        className="mx-auto h-auto w-full max-w-[220px]"
                      />
                      <span className="mt-4 mb-[15px] block font-display text-base text-brand-ink group-hover:underline">
                        {item.label}
                        <span className="sr-only"> (öffnet in neuem Tab)</span>
                      </span>
                    </a>
                    <div aria-hidden className="mb-[18px] h-[37px] border-y border-rule" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </section>
    </>
  );
}
