import "server-only";
import aboutDe from "../../content/de/about.json";
import contactDe from "../../content/de/contact.json";
import halalDe from "../../content/de/halal.json";
import impressumDe from "../../content/de/impressum.json";
import marktDe from "../../content/de/markt.json";
import pagesDe from "../../content/de/pages.json";
import servicesDe from "../../content/de/services.json";
import siteDe from "../../content/de/site.json";
import surenDe from "../../content/de/suren.json";
import vorteileDe from "../../content/de/vorteile.json";
import weblinksDe from "../../content/de/weblinks.json";
import aboutEn from "../../content/en/about.json";
import contactEn from "../../content/en/contact.json";
import halalEn from "../../content/en/halal.json";
import impressumEn from "../../content/en/impressum.json";
import marktEn from "../../content/en/markt.json";
import pagesEn from "../../content/en/pages.json";
import servicesEn from "../../content/en/services.json";
import siteEn from "../../content/en/site.json";
import surenEn from "../../content/en/suren.json";
import vorteileEn from "../../content/en/vorteile.json";
import weblinksEn from "../../content/en/weblinks.json";
import { localizeHref, type SiteLang } from "@/i18n/site";
import {
  contactSectionSchema,
  contentSectionSchema,
  impressumSchema,
  pagesSchema,
  siteSchema,
  surenSectionSchema,
  weblinksSectionSchema,
} from "./schema";

type Raw = Record<string, unknown>;

/** Parsed once at module load, so a malformed JSON file fails `next build`. */
function parse(files: Record<string, Raw>) {
  return {
    site: siteSchema.parse(files.site),
    about: contentSectionSchema.parse(files.about),
    services: contentSectionSchema.parse(files.services),
    vorteile: contentSectionSchema.parse(files.vorteile),
    halal: contentSectionSchema.parse(files.halal),
    suren: surenSectionSchema.parse(files.suren),
    markt: contentSectionSchema.parse(files.markt),
    contact: contactSectionSchema.parse(files.contact),
    weblinks: weblinksSectionSchema.parse(files.weblinks),
    impressum: impressumSchema.parse(files.impressum),
    pages: pagesSchema.parse(files.pages),
  };
}

export type SiteContent = ReturnType<typeof parse>;

/** English content keeps the German link targets; internal ones point to the /en pages. */
function localizeLinks<T>(value: T, lang: SiteLang): T {
  if (Array.isArray(value)) return value.map((v) => localizeLinks(v, lang)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, k === "href" && typeof v === "string" ? localizeHref(v, lang) : localizeLinks(v, lang)]),
    ) as T;
  }
  return value;
}

const de = { site: siteDe, about: aboutDe, services: servicesDe, vorteile: vorteileDe, halal: halalDe, suren: surenDe, markt: marktDe, contact: contactDe, weblinks: weblinksDe, impressum: impressumDe, pages: pagesDe };
const en = { site: siteEn, about: aboutEn, services: servicesEn, vorteile: vorteileEn, halal: halalEn, suren: surenEn, markt: marktEn, contact: contactEn, weblinks: weblinksEn, impressum: impressumEn, pages: pagesEn };

const SITE_CONTENT: Record<SiteLang, SiteContent> = {
  de: parse(de),
  en: localizeLinks(parse(en), "en"),
};

export function contentFor(lang: SiteLang): SiteContent {
  return SITE_CONTENT[lang];
}

/** German content (default language). */
export const content = SITE_CONTENT.de;
