import { z } from "zod";

/**
 * Shape of content/de/*.json. Texts are plain strings with two inline marks:
 *   {{text}}  → accent colour (the original site's <span class="color">)
 *   \n        → line break on desktop (a space on mobile)
 */

export const ICON_NAMES = [
  "comment",
  "asterisk",
  "eye",
  "cog",
  "cogs",
  "globe",
  "signal",
  "check",
  "warning",
  "remove",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export const ACCENTS = ["green", "orange", "lightblue", "yellow", "red", "dark"] as const;
export type Accent = (typeof ACCENTS)[number];

const text = z.string().min(1);

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(3), z.literal(6)]), text }),
  z.object({ type: z.literal("paragraph"), text }),
  z.object({
    type: z.literal("list"),
    icon: z.enum(["check", "angle", "remove", "dot"]),
    items: z.array(text).min(1),
  }),
  z.object({ type: z.literal("spacer") }),
]);
export type Block = z.infer<typeof block>;

const row = z.object({
  id: z.string().optional(),
  divider: z.boolean().optional(),
  columns: z.array(z.array(block)),
});
export type Row = z.infer<typeof row>;

const iconCard = z.object({ icon: z.enum(ICON_NAMES), color: z.enum(ACCENTS), title: text, text });
export type IconCard = z.infer<typeof iconCard>;

const statCard = z.object({
  icon: z.enum(ICON_NAMES),
  color: z.enum(ACCENTS),
  title: text,
  paragraphs: z.array(text),
});
export type StatCard = z.infer<typeof statCard>;

export const PARALLAX_IMAGES = ["p-1", "p-2", "p-3", "p-4", "p-5"] as const;
export type ParallaxImage = (typeof PARALLAX_IMAGES)[number];

const parallax = z.object({ image: z.enum(PARALLAX_IMAGES), text });

const sectionBase = z.object({
  id: z.string(),
  parallax: parallax.optional(),
  title: text,
  subtitle: z.array(text),
  message: text,
});

export const contentSectionSchema = sectionBase.extend({
  cards: z.array(iconCard).optional(),
  stats: z.array(statCard).optional(),
  rows: z.array(row).default([]),
});
export type ContentSection = z.infer<typeof contentSectionSchema>;

export const surenSectionSchema = sectionBase.extend({
  verses: z
    .array(z.object({ arabicLabel: text, arabic: text, label: text, text }))
    .min(1),
});
export type SurenSection = z.infer<typeof surenSectionSchema>;

export const contactSectionSchema = sectionBase.extend({
  form: z.object({ heading: text, name: text, email: text, message: text, submit: text }),
  office: z.object({
    heading: text,
    subheading: text,
    addressHeading: text,
    person: text,
    role: z.array(text),
    phones: z.array(text),
    address: z.array(text),
    email: z.email(),
  }),
});
export type ContactSection = z.infer<typeof contactSectionSchema>;

const logoLink = z.object({
  href: z.url({ protocol: /^https$/ }),
  label: text,
  image: z.string().startsWith("/assets/"),
});
export type LogoLink = z.infer<typeof logoLink>;

export const weblinksSectionSchema = sectionBase.extend({
  groups: z.array(z.object({ heading: text, items: z.array(logoLink) })),
});
export type WeblinksSection = z.infer<typeof weblinksSectionSchema>;

const lines = z.object({ heading: text, lines: z.array(text) });

export const impressumSchema = z.object({
  title: text,
  message: text,
  provider: lines,
  contact: lines.extend({ email: z.email(), phone: text, fax: text }),
  register: lines,
  tax: lines,
  authority: lines,
  disclaimer: z.object({
    heading: text,
    sections: z.array(z.object({ heading: text, text: z.array(text) })),
  }),
});
export type Impressum = z.infer<typeof impressumSchema>;

const simplePage = z.object({
  title: text,
  subtitle: z.array(text),
  message: text,
  paragraphs: z.array(text),
  /** Temporary text until WHU / a later stage provides the real content. */
  placeholder: z.boolean().optional(),
  link: z.object({ label: text, href: text }).optional(),
});
export type SimplePage = z.infer<typeof simplePage>;

export const pagesSchema = z.object({
  datenschutz: simplePage,
  notFound: simplePage,
});

const navItem = z.object({ label: text, href: text, highlight: z.boolean().optional() });
export type NavItem = z.infer<typeof navItem>;

const sliderImage = z.object({
  src: z.string().startsWith("/assets/"),
  alt: text,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const sliderSlide = z.object({
  title: text,
  subtitle: text,
  intro: text.optional(),
  items: z.array(text),
  images: z.array(sliderImage).min(1),
});
export type SliderSlide = z.infer<typeof sliderSlide>;

const heroSlide = z.object({
  image: z.string().startsWith("/assets/"),
  links: z.array(z.object({ label: text, href: z.string().startsWith("#") })),
});
export type HeroSlide = z.infer<typeof heroSlide>;

export const siteSchema = z.object({
  meta: z.object({ title: text, description: text, keywords: z.array(text), siteName: text }),
  nav: z.array(navItem),
  hero: z.array(heroSlide).min(1),
  slider: z.array(sliderSlide).min(1),
  closingParallax: z.object({ image: z.enum(PARALLAX_IMAGES) }),
  footer: z.object({
    orgName: text,
    links: z.array(z.object({ label: text, href: text })),
    addressHeading: text,
    office: text,
    officeEn: text,
    person: z.array(text),
    address: z.array(text),
    phone: text,
    fax: text,
    email: z.email(),
    copyright: text,
  }),
});
export type Site = z.infer<typeof siteSchema>;
