"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavItem } from "@/content/schema";
import { LANGUAGE_NAMES, SITE_LANGS, type SiteLang, sitePath, siteUi } from "@/i18n/site";

type Props = {
  nav: NavItem[];
  /** "home": anchors scroll within the page and the active item follows the scroll. */
  variant: "home" | "page";
  lang: SiteLang;
  /** The same page in each language (language switch). */
  alternates: Record<SiteLang, string>;
};

const HEADER_OFFSET = 96;

function sectionIdOf(href: string): string | null {
  const hash = href.split("#")[1];
  return hash ?? null;
}

/**
 * White menu bar. On the home page it sits below the full-screen hero and
 * sticks to the top once scrolled past (the original jQuery "sticky" menu),
 * which plain `position: sticky` reproduces without JavaScript.
 */
export function Header({ nav, variant, lang, alternates }: Props) {
  const t = siteUi(lang);
  const home = sitePath("home", lang);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(variant === "home" ? "top" : null);

  // Scrollspy: highlight the menu item of the section currently under the header.
  useEffect(() => {
    if (variant !== "home") return;
    const ids = nav.map((item) => sectionIdOf(item.href)).filter((id): id is string => Boolean(id));
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - HEADER_OFFSET <= 0) current = id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [nav, variant]);

  // On the home page "/#about" (or "/en#about") becomes a plain in-page anchor.
  const anchorPrefix = home === "/" ? "/#" : `${home}#`;
  const hrefFor = (item: NavItem) =>
    variant === "home" && item.href.startsWith(anchorPrefix) ? item.href.slice(anchorPrefix.length - 1) : item.href;

  const languageSwitch = (mobile: boolean) => (
    <ul aria-label={t.languageNav} className={mobile ? "flex gap-2 px-4 py-3" : "ml-3 flex items-center gap-1 border-l border-rule pl-3"}>
      {SITE_LANGS.map((l) => (
        <li key={l}>
          {l === lang ? (
            <span aria-current="true" className="inline-block rounded px-1.5 py-0.5 text-[12px] font-semibold text-brand-ink" title={LANGUAGE_NAMES[l].long}>
              {LANGUAGE_NAMES[l].short}
            </span>
          ) : (
            <a href={alternates[l]} hrefLang={l} lang={l} title={LANGUAGE_NAMES[l].long} className="inline-block rounded px-1.5 py-0.5 text-[12px] text-[#767676] hover:text-brand-ink">
              {LANGUAGE_NAMES[l].short}
            </a>
          )}
        </li>
      ))}
    </ul>
  );

  const linkClass = (item: NavItem, mobile: boolean) => {
    const active = sectionIdOf(item.href) !== null && sectionIdOf(item.href) === activeId;
    if (mobile) {
      return `block border-b border-rule px-4 py-3 text-sm uppercase ${
        active ? "bg-brand/10 text-brand-ink" : item.highlight ? "font-semibold text-brand-ink" : "text-[#666]"
      }`;
    }
    // Active/hover: the original teal tab with an accent underline. The tab colour is
    // the darker brand-ink so its white label stays readable (WCAG AA).
    const base =
      "group relative inline-flex h-[74px] items-center px-3 text-[13px] uppercase transition-colors duration-200";
    const tab = "border-b-[3px] border-brand bg-brand-ink text-white";
    if (active) return `${base} ${tab}`;
    if (item.highlight)
      return `${base} font-semibold text-brand-ink hover:border-b-[3px] hover:border-brand hover:bg-brand-ink hover:text-white`;
    return `${base} text-[#767676] hover:border-b-[3px] hover:border-brand hover:bg-brand-ink hover:text-white`;
  };

  return (
    <header className="sticky top-0 z-50 h-[74px] bg-white/95 shadow-[0_1px_0_#e7e7e7]">
      <div className="mx-auto flex h-full w-full max-w-[972px] items-center justify-between px-4">
        <Link href={home === "/" ? "/#top" : `${home}#top`} aria-label={t.toHome} className="shrink-0">
          <Image
            src="/assets/brand/whu-logo.png"
            alt="WHU – World Halal Union"
            width={123}
            height={72}
            className="h-[60px] w-auto sm:h-[72px]"
          />
        </Link>

        <div className="hidden items-center lg:flex">
          <nav aria-label={t.mainNav}>
            <ul className="flex">
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={hrefFor(item)} className={linkClass(item, false)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {languageSwitch(false)}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded text-[#666] hover:text-brand lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t.closeMenu : t.openMenu}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <nav
        id="mobile-nav"
        aria-label={t.mainNav}
        hidden={!open}
        className="absolute inset-x-0 top-full bg-white shadow-md lg:hidden"
      >
        <ul>
          {nav.map((item) => (
            <li key={item.href}>
              <a href={hrefFor(item)} className={linkClass(item, true)} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        {languageSwitch(true)}
      </nav>
    </header>
  );
}
