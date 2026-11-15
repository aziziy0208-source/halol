import Link from "next/link";
import { cacheLife } from "next/cache";
import { content } from "@/content";
import { FaIcon, ICONS } from "@/components/icons";
import { Container } from "./layout-primitives";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/**
 * Dark footer with the legal links and the office address. Replaces the
 * original "+" slide-out panel and its "QF 2014" footer line.
 */
export function Footer() {
  const f = content.site.footer;
  return (
    <footer className="bg-[#3a3a3a] text-[#c8c8c8]">
      <Container className="grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h2 className="mb-4 text-xl text-[#dedede]">{f.orgName}</h2>
          <ul className="border-t border-[#4d4d4d]">
            {f.links.map((link) => (
              <li key={link.href} className="border-b border-[#2b2b2b] py-2">
                <Link href={link.href} className="text-[#dedede] hover:text-brand">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 md:justify-self-end">
          <h2 className="mb-4 text-xl text-[#dedede]">{f.addressHeading}</h2>
          <p className="mb-1 font-semibold text-[#dedede]">{f.office}</p>
          <p className="mb-3">{f.officeEn}</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <FaIcon icon={ICONS.user} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
              <span>
                {f.person.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
            <li className="flex gap-2">
              <FaIcon icon={ICONS.home} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
              <address className="not-italic">
                {f.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
            <li className="flex gap-2">
              <FaIcon icon={ICONS.phone} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
              <a href={`tel:${f.phone.replace(/[^\d+]/g, "")}`} className="hover:text-brand">
                {f.phone}
              </a>
            </li>
            <li className="flex gap-2">
              <FaIcon icon={ICONS.fax} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
              <span>{f.fax}</span>
            </li>
            <li className="flex gap-2">
              <FaIcon icon={ICONS.envelope} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
              <a href={`mailto:${f.email}`} className="hover:text-brand">
                {f.email}
              </a>
            </li>
          </ul>
        </div>
      </Container>
      <div className="bg-black py-6 text-center text-sm text-[#a0a0a0]">
        © <CurrentYear /> {f.copyright}
      </div>
    </footer>
  );
}
