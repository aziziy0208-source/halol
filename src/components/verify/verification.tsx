import {
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faClockRotateLeft,
  faFilePdf,
  faHourglassEnd,
  faTriangleExclamation,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaIcon } from "@/components/icons";
import { Footer } from "@/components/site/footer";
import { content } from "@/content";
import { countryName, formatVerifyDate, formatVerifyDateTime, type VerifyLang, verifyTexts } from "@/i18n/verify";
import type { PublicCertificate, PublicStatus } from "@/lib/verify/lookup";

/**
 * Public verification page (spec §8.2): mobile first, no client JavaScript of its own.
 * Status colours keep white text at ≥ 4.5:1 contrast.
 */

const TONES: Record<PublicStatus | "NOT_FOUND", { className: string; icon: IconDefinition }> = {
  VALID: { className: "bg-[#15803d]", icon: faCircleCheck },
  EXPIRED: { className: "bg-[#52525b]", icon: faHourglassEnd },
  SUSPENDED: { className: "bg-[#c2410c]", icon: faTriangleExclamation },
  REVOKED: { className: "bg-[#b91c1c]", icon: faCircleXmark },
  SUPERSEDED: { className: "bg-[#1d4ed8]", icon: faClockRotateLeft },
  NOT_FOUND: { className: "bg-[#7f1d1d]", icon: faCircleQuestion },
};

const PRODUCTS_SHOWN = 12;

export function VerifyFrame({ lang, switchHref, children }: { lang: VerifyLang; switchHref: string; children: ReactNode }) {
  const t = verifyTexts(lang);
  const other: VerifyLang = lang === "de" ? "en" : "de";
  return (
    <div lang={lang} className="flex flex-1 flex-col bg-[#f3f5f7]">
      <header className="bg-white shadow-[0_1px_0_#e7e7e7]">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/assets/brand/whu-logo.png" alt="WHU – World Halal Union" width={123} height={72} priority className="h-11 w-auto" />
            <span className="truncate text-sm font-semibold text-[#1b1b1b]">{t.pageTitle}</span>
          </Link>
          <a
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="shrink-0 rounded border border-[#d0d5da] px-2.5 py-1 text-sm text-brand-ink hover:border-brand"
          >
            {t.switchTo}
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 space-y-4 px-4 py-5">{children}</main>
      <Footer />
    </div>
  );
}

function Banner({ tone, label, text, children }: { tone: keyof typeof TONES; label: string; text: string; children?: ReactNode }) {
  const { className, icon } = TONES[tone];
  return (
    <section aria-labelledby="verify-status" className={`rounded-xl px-5 py-6 text-white shadow-sm ${className}`}>
      <div className="flex items-center gap-4">
        <FaIcon icon={icon} className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <h1 id="verify-status" className="text-3xl leading-tight font-bold tracking-wide text-white">
            {label}
          </h1>
          <p className="mt-1 text-base leading-snug text-white">{text}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white px-5 py-4 shadow-sm">
      {title ? <h2 className="mb-3 text-lg font-semibold text-[#1b1b1b]">{title}</h2> : null}
      {children}
    </section>
  );
}

function Contact({ lang }: { lang: VerifyLang }) {
  const f = content.site.footer;
  const phone = f.phone.replace(/^[^+\d]*/, "");
  const link = "text-[#005c7d] underline";
  return (
    <ul className="mt-2 space-y-1">
      <li>
        <a href={`mailto:${f.email}`} className={link}>
          {f.email}
        </a>
      </li>
      <li>
        <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={link}>
          {phone}
        </a>
      </li>
      <li>
        <Link href="/#contact" className={link}>
          {lang === "de" ? "Kontaktformular" : "Contact form"}
        </Link>
      </li>
    </ul>
  );
}

function Warning({ lang, title, text }: { lang: VerifyLang; title: string; text: string }) {
  return (
    <section className="rounded-xl border border-[#f2c879] bg-[#fff8e6] px-5 py-4 text-[#4a3500]">
      <h2 className="flex items-center gap-2 font-semibold">
        <FaIcon icon={faTriangleExclamation} className="h-4 w-4" />
        {title}
      </h2>
      <p className="mt-1">{text}</p>
      <Contact lang={lang} />
    </section>
  );
}

function CheckedAt({ lang, at }: { lang: VerifyLang; at: Date }) {
  return <p className="text-center text-sm text-[#6b6b6b]">{verifyTexts(lang).checkedAt(formatVerifyDateTime(at, lang))}</p>;
}

export function VerificationResult({ cert, lang, checkedAt }: { cert: PublicCertificate; lang: VerifyLang; checkedAt: Date }) {
  const t = verifyTexts(lang);
  const date = (iso: string) => formatVerifyDate(iso, lang);
  const s = t.status[cert.status];
  const statusText =
    cert.status === "VALID" || cert.status === "EXPIRED"
      ? s.text(date(cert.validUntil))
      : cert.status === "SUSPENDED" || cert.status === "REVOKED"
        ? s.text(cert.statusSince ? date(cert.statusSince) : "—")
        : s.text("");
  const number = cert.revision > 0 ? `${cert.number} · Rev. ${cert.revision}` : cert.number;
  const c = cert.company;
  const f = content.site.footer;

  const rows: [string, ReactNode][] = [
    [t.certificateNo, <span key="n" className="font-mono font-semibold tracking-wide">{number}</span>],
    [
      t.holder,
      <span key="h">
        <span className="block font-semibold text-[#1b1b1b]">
          {c.name}
          {c.legalForm && !c.name.includes(c.legalForm) ? ` ${c.legalForm}` : ""}
        </span>
        <span className="block">{c.address}</span>
        <span className="block">
          {[c.postalCode, c.city].filter(Boolean).join(" ")}
          {c.postalCode || c.city ? ", " : ""}
          {countryName(c.country, lang)}
        </span>
      </span>,
    ],
    ...(cert.productionSite ? [[t.productionSite, cert.productionSite] as [string, ReactNode]] : []),
    [t.scope, cert.scope],
    ...(cert.category ? [[t.category, cert.category] as [string, ReactNode]] : []),
    [
      t.standards,
      <span key="s">
        {cert.standards.map((st) => (
          <span key={st.code} className="block">
            <span className="font-semibold">{st.code}</span> – {st.title}
          </span>
        ))}
      </span>,
    ],
    [t.issueDate, date(cert.issueDate)],
    [t.validUntil, date(cert.validUntil)],
    [
      t.body,
      <span key="b">
        <span className="block">{t.bodyName}</span>
        {f.address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>,
    ],
  ];

  const product = (p: PublicCertificate["products"][number], i: number) => (
    <li key={i} className="py-1.5">
      <span className="text-[#1b1b1b]">{p.name}</span>
      {p.brand || p.articleNo ? (
        <span className="block text-sm text-[#6b6b6b]">
          {[p.brand ? `${t.brand}: ${p.brand}` : null, p.articleNo ? `${t.articleNo} ${p.articleNo}` : null].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </li>
  );

  return (
    <>
      <Banner tone={cert.status} label={s.label} text={statusText}>
        {cert.current ? (
          <a
            href={`/v/${cert.current.token}?lang=${lang}`}
            className="mt-4 inline-block rounded-md bg-white px-4 py-2 font-semibold text-[#1d4ed8] hover:bg-blue-50"
          >
            {t.showCurrent(cert.current.revision)} →
          </a>
        ) : null}
      </Banner>

      <Card>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sm text-[#6b6b6b] sm:pt-0.5">{k}</dt>
              <dd className="-mt-2 min-w-0 break-words sm:mt-0">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {cert.products.length ? (
        <Card title={t.products(cert.products.length)}>
          <ol className="divide-y divide-[#eceff1]">{cert.products.slice(0, PRODUCTS_SHOWN).map(product)}</ol>
          {cert.products.length > PRODUCTS_SHOWN ? (
            <details className="mt-1">
              <summary className="cursor-pointer py-2 text-brand-ink">{t.showAllProducts(cert.products.length)}</summary>
              <ol className="divide-y divide-[#eceff1]" start={PRODUCTS_SHOWN + 1}>
                {cert.products.slice(PRODUCTS_SHOWN).map((p, i) => product(p, i + PRODUCTS_SHOWN))}
              </ol>
            </details>
          ) : null}
        </Card>
      ) : null}

      <Card title={t.document}>
        {cert.documentAvailable ? (
          <div className="space-y-4">
            <a
              href={`/v/${cert.token}/certificate.pdf`}
              className="inline-flex items-center gap-2 rounded-md bg-brand-ink px-4 py-2.5 font-semibold text-white hover:bg-[#006a8f]"
            >
              <FaIcon icon={faFilePdf} className="h-4 w-4" />
              {t.downloadPdf}
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element -- private, status-dependent image route */}
            <img
              src={`/v/${cert.token}/preview.webp`}
              alt={t.previewAlt(cert.number)}
              width={990}
              height={1400}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded border border-[#e3e6e8] bg-white"
            />
          </div>
        ) : (
          <p className="text-[#545454]">{cert.isLegacy ? t.legacy : t.noDocument}</p>
        )}
      </Card>

      <Warning lang={lang} title={t.warningTitle} text={t.warning} />
      <CheckedAt lang={lang} at={checkedAt} />
    </>
  );
}

export function VerificationNotFound({ lang, checkedAt }: { lang: VerifyLang; checkedAt: Date }) {
  const t = verifyTexts(lang);
  return (
    <>
      <Banner tone="NOT_FOUND" label={t.notFound.label} text={t.notFound.text} />
      <Warning lang={lang} title={t.notFound.title} text={t.notFound.warning} />
      <p className="text-center">
        <Link href={`/zertifikat-pruefen?lang=${lang}`} className="text-brand-ink underline">
          {t.manual.title}
        </Link>
      </p>
      <CheckedAt lang={lang} at={checkedAt} />
    </>
  );
}

export function VerificationRateLimited({ lang }: { lang: VerifyLang }) {
  const t = verifyTexts(lang);
  return (
    <Card title={t.rateLimited.title}>
      <p>{t.rateLimited.text}</p>
    </Card>
  );
}

export function VerificationLoading() {
  return (
    <p role="status" className="mx-auto max-w-[720px] px-4 py-16 text-center text-[#6b6b6b]">
      {verifyTexts("de").checking} · <span lang="en">{verifyTexts("en").checking}</span>
    </p>
  );
}
