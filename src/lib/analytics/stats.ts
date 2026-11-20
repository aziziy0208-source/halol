import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Aggregates for the admin statistics page. Days follow WHU's time zone
 * (Europe/Berlin). "Visitors" = distinct daily hashes, so a person who comes back on
 * three days counts three times (hashes can't be linked across days by design).
 */
export const STAT_RANGES = [1, 7, 30, 90, 365] as const;
export type StatRange = (typeof STAT_RANGES)[number];

export type Row = { label: string | null; value: number };
export type PageRow = { label: string; views: number; visitors: number };
export type DayRow = { day: string; views: number; visitors: number };

const LOCAL = Prisma.sql`("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')`;
const TODAY = Prisma.sql`(now() AT TIME ZONE 'Europe/Berlin')::date`;

/** Rows of the last `days` days, today included; `offset` shifts the window back (previous period). */
function window(days: number, offset = 0) {
  return Prisma.sql`${LOCAL}::date > ${TODAY} - ${days + offset}::int AND ${LOCAL}::date <= ${TODAY} - ${offset}::int`;
}

/** Whitelisted columns (interpolated into SQL as identifiers). */
type Column = "country" | "device" | "browser" | "os" | "language" | "siteLang";

async function byVisitors(days: number, column: Column, limit = 12): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT ${Prisma.raw(`"${column}"`)} AS label, count(DISTINCT "visitorHash")::int AS value
    FROM "PageView" WHERE ${window(days)}
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${limit}`;
}

async function totals(days: number, offset = 0) {
  const [row] = await prisma.$queryRaw<{ views: number; visitors: number }[]>`
    SELECT count(*)::int AS views, count(DISTINCT "visitorHash")::int AS visitors
    FROM "PageView" WHERE ${window(days, offset)}`;
  return row ?? { views: 0, visitors: 0 };
}

/** First page view of each visitor in the period: where the visit came from. */
const ENTRIES = (days: number) => Prisma.sql`
  WITH entries AS (
    SELECT DISTINCT ON ("visitorHash") source, "sourceName", "utmSource", "utmMedium", "utmCampaign", path
    FROM "PageView" WHERE ${window(days)}
    ORDER BY "visitorHash", "createdAt"
  )`;

export async function loadStatistics(days: StatRange) {
  const [
    current,
    previous,
    live,
    daily,
    sources,
    searchEngines,
    social,
    referrers,
    campaigns,
    entryPages,
    pages,
    countries,
    cities,
    devices,
    browsers,
    os,
    languages,
    siteLanguages,
    hours,
    scans,
    scanCountries,
    topCertificates,
  ] = await Promise.all([
    totals(days),
    totals(days, days),
    prisma.$queryRaw<{ value: number }[]>`
      SELECT count(DISTINCT "visitorHash")::int AS value FROM "PageView"
      WHERE "createdAt" > (now() AT TIME ZONE 'UTC') - interval '5 minutes'`,
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(v.views, 0)::int AS views, coalesce(v.visitors, 0)::int AS visitors
      FROM generate_series((${TODAY} - ${days - 1}::int)::timestamp, ${TODAY}::timestamp, interval '1 day') AS d
      LEFT JOIN (
        SELECT ${LOCAL}::date AS day, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
        FROM "PageView" WHERE ${window(days)} GROUP BY 1
      ) v ON v.day = d::date
      ORDER BY d`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)} SELECT source AS label, count(*)::int AS value FROM entries GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)} SELECT "sourceName" AS label, count(*)::int AS value FROM entries WHERE source = 'search' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)} SELECT "sourceName" AS label, count(*)::int AS value FROM entries WHERE source IN ('social', 'ai', 'email') GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)} SELECT "sourceName" AS label, count(*)::int AS value FROM entries WHERE source = 'referral' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)}
      SELECT concat_ws(' / ', "utmSource", "utmMedium", "utmCampaign") AS label, count(*)::int AS value
      FROM entries WHERE source = 'campaign' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<Row[]>`${ENTRIES(days)} SELECT path AS label, count(*)::int AS value FROM entries GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    prisma.$queryRaw<PageRow[]>`
      SELECT path AS label, count(*)::int AS views, count(DISTINCT "visitorHash")::int AS visitors
      FROM "PageView" WHERE ${window(days)} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15`,
    byVisitors(days, "country", 20),
    prisma.$queryRaw<Row[]>`
      SELECT CASE WHEN city IS NULL THEN NULL ELSE concat(city, coalesce(', ' || region, ''), coalesce(' (' || country || ')', '')) END AS label,
             count(DISTINCT "visitorHash")::int AS value
      FROM "PageView" WHERE ${window(days)} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15`,
    byVisitors(days, "device"),
    byVisitors(days, "browser"),
    byVisitors(days, "os"),
    byVisitors(days, "language", 15),
    byVisitors(days, "siteLang"),
    prisma.$queryRaw<{ hour: number; value: number }[]>`
      SELECT extract(hour FROM ${LOCAL})::int AS hour, count(DISTINCT "visitorHash")::int AS value
      FROM "PageView" WHERE ${window(days)} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ channel: string; value: number }[]>`
      SELECT channel::text AS channel, count(*)::int AS value FROM "ScanLog"
      WHERE ("scannedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date > ${TODAY} - ${days}::int
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT country AS label, count(*)::int AS value FROM "ScanLog"
      WHERE ("scannedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date > ${TODAY} - ${days}::int
      GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.$queryRaw<{ id: string; number: string | null; company: string; value: number }[]>`
      SELECT c.id, c."certificateNumber" AS number, co.name AS company, count(*)::int AS value
      FROM "ScanLog" s JOIN "Certificate" c ON c.id = s."certificateId" JOIN "Company" co ON co.id = c."companyId"
      WHERE (s."scannedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date > ${TODAY} - ${days}::int
      GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 10`,
  ]);

  return {
    current,
    previous,
    live: live[0]?.value ?? 0,
    daily,
    sources,
    searchEngines,
    social,
    referrers,
    campaigns,
    entryPages,
    pages,
    countries,
    cities,
    devices,
    browsers,
    os,
    languages,
    siteLanguages,
    hours,
    scans: { qr: scans.find((s) => s.channel === "QR")?.value ?? 0, manual: scans.find((s) => s.channel === "MANUAL")?.value ?? 0 },
    scanCountries,
    topCertificates,
  };
}

export type Statistics = Awaited<ReturnType<typeof loadStatistics>>;
