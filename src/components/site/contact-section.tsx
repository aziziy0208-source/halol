import type { ContactSection as ContactSectionData } from "@/content/schema";
import { FaIcon, ICONS } from "@/components/icons";
import { ContactForm } from "./contact-form";
import { Container, MessageBlock, TitleBar } from "./layout-primitives";
import { Parallax } from "./parallax";

/** "+49 17 42 495 885" → "+49174249588" for tel: links (drops the "Tel (work):" label). */
function telHref(label: string): string {
  return `tel:${label.replace(/^.*?:/, "").replace(/[^\d+]/g, "")}`;
}

export function ContactSection({ section }: { section: ContactSectionData }) {
  const o = section.office;
  return (
    <>
      {section.parallax ? <Parallax image={section.parallax.image} text={section.parallax.text} /> : null}
      <section id={section.id} className="pt-6 pb-16">
        <Container>
          <TitleBar title={section.title} subtitle={section.subtitle} />
          <MessageBlock text={section.message} />
          <div className="grid gap-x-5 gap-y-8 md:grid-cols-2">
            <div>
              <h3 className="mb-[18px] text-xl">{section.form.heading}</h3>
              <ContactForm labels={section.form} />
            </div>
            <div>
              <h3 className="mb-[18px] text-xl">{o.heading}</h3>
              <p className="mb-[18px] text-brand-ink">{o.subheading}</p>
              <h3 className="mb-[18px] text-xl">{o.addressHeading}</h3>
              <ul className="space-y-0.5">
                <li className="flex gap-1.5">
                  <FaIcon icon={ICONS.user} className="mt-1 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {o.person}
                    {o.role.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </li>
                {o.phones.map((phone) => (
                  <li key={phone} className="flex gap-1.5">
                    <FaIcon icon={ICONS.phone} className="mt-1 h-3.5 w-3.5 shrink-0" />
                    {/* min-h-6: 24px touch target for phone numbers on mobile */}
                    <a href={telHref(phone)} className="inline-block min-h-6 hover:text-brand-ink">
                      {phone}
                    </a>
                  </li>
                ))}
                <li className="flex gap-1.5">
                  <FaIcon icon={ICONS.home} className="mt-1 h-3.5 w-3.5 shrink-0" />
                  <address className="not-italic">
                    {o.address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </li>
                <li className="flex gap-1.5">
                  <FaIcon icon={ICONS.envelope} className="mt-1 h-3.5 w-3.5 shrink-0" />
                  <a href={`mailto:${o.email}`} className="inline-block min-h-6 text-brand-ink hover:underline">
                    {o.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
