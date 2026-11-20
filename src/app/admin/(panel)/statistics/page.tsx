import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminLocale, adminT } from "@/i18n/admin/server";
import { loadStatistics, type Row, STAT_RANGES, type StatRange } from "@/lib/analytics/stats";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Statistics" };

type T = Awaited<ReturnType<typeof adminT>>["statistics"];

const BAR = "#0b7fab"; // brand ink (single-series magnitude)
const fmt = (n: number, locale: string) => new Intl.NumberFormat(locale === "uz" ? "uz-Latn" : "en-GB").format(n);

/** "DE" → "🇩🇪" */
function flag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

/** Ranked list with proportional bars (the numbers are the table view). */
function Breakdown({
  title,
  rows,
  label,
  total,
  t,
  locale,
}: {
  title: string;
  rows: Row[];
  label?: (value: string) => string;
  total?: number;
  t: T;
  locale: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">{t.none}</p>
      ) : (
        <ul className="space-y-1 px-5 py-3 text-sm">
          {rows.map((r, i) => {
            const text = r.label === null || r.label === "" ? t.unknown : label ? label(r.label) : r.label;
            return (
              <li key={`${r.label}-${i}`} className="relative flex items-center justify-between gap-3 py-1">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r bg-sky-100"
                  style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                />
                <span className="relative min-w-0 truncate pl-2 text-slate-800">{text}</span>
                <span className="relative shrink-0 pr-1 text-slate-600 tabular-nums">
                  {fmt(r.value, locale)}
                  {total ? <span className="ml-1.5 text-xs text-slate-400">{Math.round((r.value / total) * 100)}%</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Daily visitors: one series, thin bars, hover shows visitors and page views. */
function DailyChart({ rows, t, locale }: { rows: { day: string; views: number; visitors: number }[]; t: T; locale: string }) {
  const W = 1000;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 24, left: 36 };
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  const step = (W - pad.left - pad.right) / Math.max(1, rows.length);
  const barW = Math.max(1.5, Math.min(28, step - 2));
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale === "uz" ? "uz-Latn" : "en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const ticks = [0, Math.ceil(max / 2), max];
  const labelIdx = rows.length <= 1 ? [0] : [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={t.perDay}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#64748b">
            {v}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = pad.left + i * step + (step - barW) / 2;
        const top = y(r.visitors);
        const h = Math.max(0, H - pad.bottom - top);
        return (
          <g key={r.day}>
            {/* Hit target taller and wider than the bar */}
            <rect x={pad.left + i * step} y={pad.top} width={step} height={H - pad.top - pad.bottom} fill="transparent">
              <title>{t.perDayTooltip(r.day, r.visitors, r.views)}</title>
            </rect>
            {h > 0 ? (
              <rect x={x} y={top} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={BAR} pointerEvents="none" />
            ) : null}
          </g>
        );
      })}
      {labelIdx.map((i) => (
        <text
          key={i}
          x={pad.left + i * step + step / 2}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"}
          fontSize={11}
          fill="#64748b"
        >
          {rows[i] ? day(rows[i].day) : ""}
        </text>
      ))}
    </svg>
  );
}

function HourChart({ rows, t }: { rows: { hour: number; value: number }[]; t: T }) {
  const values = Array.from({ length: 24 }, (_, h) => rows.find((r) => r.hour === h)?.value ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-28 items-end gap-0.5 px-5 pt-3 pb-1" role="img" aria-label={t.byHour}>
      {values.map((v, h) => (
        <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${String(h).padStart(2, "0")}:00 — ${v}`}>
          <div className="w-full rounded-t bg-[#0b7fab]" style={{ height: `${(v / max) * 80}px`, minHeight: v ? 2 : 0 }} />
          <span className="text-[9px] text-slate-400 tabular-nums">{h % 3 === 0 ? h : ""}</span>
        </div>
      ))}
    </div>
  );
}

export default async function StatisticsPage({ searchParams }: PageProps<"/admin/statistics">) {
  const user = await requireUser();
  if (!can(user.role, "stats.view")) return <Forbidden />;
  const locale = await adminLocale();
  const t = (await adminT()).statistics;
  const requested = Number((await searchParams).range);
  const range: StatRange = (STAT_RANGES as readonly number[]).includes(requested) ? (requested as StatRange) : 30;
  const s = await loadStatistics(range);

  const regions = new Intl.DisplayNames([locale === "uz" ? "uz" : "en"], { type: "region" });
  const languages = new Intl.DisplayNames([locale === "uz" ? "uz" : "en"], { type: "language" });
  const country = (code: string) => {
    try {
      return `${flag(code)} ${regions.of(code) ?? code}`;
    } catch {
      return code;
    }
  };
  const language = (code: string) => {
    try {
      return `${languages.of(code) ?? code} (${code})`;
    } catch {
      return code;
    }
  };
  const change = (now: number, before: number) => {
    if (before === 0) return t.noPrevious;
    const pct = Math.round(((now - before) / before) * 100);
    return t.vsPrevious(`${pct > 0 ? "+" : ""}${pct}%`);
  };
  const visitors = s.current.visitors;

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle}>
        <nav aria-label={t.title} className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm">
          {STAT_RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/statistics?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded px-3 py-1 ${r === range ? "bg-brand-ink font-medium text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t.ranges[r]}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t.visitors} value={fmt(visitors, locale)} hint={change(visitors, s.previous.visitors)} />
        <Kpi label={t.pageViews} value={fmt(s.current.views, locale)} hint={change(s.current.views, s.previous.views)} />
        <Kpi label={t.perVisitor} value={visitors ? (s.current.views / visitors).toFixed(1) : "—"} />
        <Kpi label={t.liveNow} value={fmt(s.live, locale)} hint={t.liveHint} />
        <Kpi label={t.qrScans} value={fmt(s.scans.qr, locale)} />
        <Kpi label={t.manualChecks} value={fmt(s.scans.manual, locale)} />
      </div>

      {range > 1 ? (
        <Card className="mb-6">
          <CardHeader title={t.perDay} />
          <div className="px-3 py-2">
            <DailyChart rows={s.daily} t={t} locale={locale} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title={t.sources} rows={s.sources} label={(v) => t.sourceNames[v] ?? v} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.searchEngines} rows={s.searchEngines} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.socialAi} rows={s.social} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.referrers} rows={s.referrers} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.countries} rows={s.countries} label={country} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.cities} rows={s.cities} total={visitors} t={t} locale={locale} />
        <Card>
          <CardHeader title={t.pages} />
          {s.pages.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">{t.none}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="px-5 pt-2 text-left font-medium" />
                  <th className="px-2 pt-2 text-right font-medium">{t.visitors}</th>
                  <th className="px-5 pt-2 text-right font-medium">{t.pageViews}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.pages.map((p) => (
                  <tr key={p.label}>
                    <td className="max-w-0 truncate px-5 py-1.5 font-mono text-xs text-slate-800">{p.label}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">{fmt(p.visitors, locale)}</td>
                    <td className="px-5 py-1.5 text-right text-slate-800 tabular-nums">{fmt(p.views, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Breakdown title={t.entryPages} rows={s.entryPages} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.devices} rows={s.devices} label={(v) => t.deviceNames[v] ?? v} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.browsers} rows={s.browsers} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.os} rows={s.os} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.languages} rows={s.languages} label={language} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.siteLanguages} rows={s.siteLanguages} label={(v) => v.toUpperCase()} total={visitors} t={t} locale={locale} />
        <Breakdown title={t.campaigns} rows={s.campaigns} t={t} locale={locale} />
        <Card>
          <CardHeader title={t.byHour} />
          <HourChart rows={s.hours} t={t} />
        </Card>
        <Breakdown title={t.scanCountries} rows={s.scanCountries} label={country} t={t} locale={locale} />
        <Card>
          <CardHeader title={t.topCertificates} />
          {s.topCertificates.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">{t.none}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {s.topCertificates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2">
                  <Link href={`/admin/certificates/${c.id}`} className="min-w-0 truncate text-brand-ink hover:underline">
                    <span className="font-mono">{c.number}</span> <span className="text-slate-600">· {c.company}</span>
                  </Link>
                  <span className="shrink-0 text-slate-700 tabular-nums">{fmt(c.value, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 max-w-4xl text-xs leading-relaxed text-slate-500">{t.privacy}</p>
    </>
  );
}
