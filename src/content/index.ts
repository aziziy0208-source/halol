import "server-only";
import about from "../../content/de/about.json";
import contact from "../../content/de/contact.json";
import halal from "../../content/de/halal.json";
import impressum from "../../content/de/impressum.json";
import markt from "../../content/de/markt.json";
import pages from "../../content/de/pages.json";
import services from "../../content/de/services.json";
import site from "../../content/de/site.json";
import suren from "../../content/de/suren.json";
import vorteile from "../../content/de/vorteile.json";
import weblinks from "../../content/de/weblinks.json";
import {
  contactSectionSchema,
  contentSectionSchema,
  impressumSchema,
  pagesSchema,
  siteSchema,
  surenSectionSchema,
  weblinksSectionSchema,
} from "./schema";

/**
 * German site content. Parsed once at module load, so a malformed JSON file
 * fails `next build` instead of rendering a broken page.
 */
export const content = {
  site: siteSchema.parse(site),
  about: contentSectionSchema.parse(about),
  services: contentSectionSchema.parse(services),
  vorteile: contentSectionSchema.parse(vorteile),
  halal: contentSectionSchema.parse(halal),
  suren: surenSectionSchema.parse(suren),
  markt: contentSectionSchema.parse(markt),
  contact: contactSectionSchema.parse(contact),
  weblinks: weblinksSectionSchema.parse(weblinks),
  impressum: impressumSchema.parse(impressum),
  pages: pagesSchema.parse(pages),
};
