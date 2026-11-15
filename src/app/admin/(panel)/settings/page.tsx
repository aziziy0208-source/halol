import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { imageDataUri } from "@/certificates/load";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { formatCertificateNumber } from "@/lib/certificates/number";
import { businessToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { GeneralSettingsForm, SignatoryCard, SignatoryCreateForm, StandardCreateForm, StandardRow } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) return <Forbidden />;
  const t = (await adminT()).settings;

  const year = businessToday().getUTCFullYear();
  const [settings, counter, standards, signatories] = await Promise.all([
    getSettings(),
    prisma.counter.findUnique({ where: { year } }),
    prisma.standard.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { _count: { select: { certificates: true } } },
    }),
    prisma.signatory.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
  ]);
  const signatoryImages = await Promise.all(
    signatories.map(async (s) => ({
      ...s,
      signature: await imageDataUri(s.signatureImageKey),
      stamp: await imageDataUri(s.stampImageKey),
    })),
  );
  const nextNumber = formatCertificateNumber(year, (counter?.lastNumber ?? 0) + 1, settings.numberFormat);

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div className="space-y-6">
        <Card>
          <CardHeader title={t.general.title} />
          <GeneralSettingsForm values={settings} nextNumber={nextNumber} />
        </Card>

        <Card>
          <CardHeader title={t.standards.title} />
          <p className="px-5 pt-4 text-xs text-slate-500">{t.standards.hint}</p>
          {standards.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">{t.standards.empty}</p> : null}
          <ul className="divide-y divide-slate-100">
            {standards.map((s) => (
              <StandardRow
                key={s.id}
                standard={{ id: s.id, code: s.code, title: s.title, isActive: s.isActive, usage: s._count.certificates }}
              />
            ))}
          </ul>
          <StandardCreateForm />
        </Card>

        <Card>
          <CardHeader title={t.signatories.title} />
          <p className="px-5 pt-4 text-xs text-slate-500">{t.signatories.hint}</p>
          {signatories.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">{t.signatories.empty}</p> : null}
          <ul className="divide-y divide-slate-100">
            {signatoryImages.map((s) => (
              <SignatoryCard
                key={s.id}
                signatory={{ id: s.id, name: s.name, title: s.title, isActive: s.isActive, signature: s.signature, stamp: s.stamp }}
              />
            ))}
          </ul>
          <SignatoryCreateForm />
        </Card>

        <Card>
          <CardHeader title={t.users.title} />
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-slate-600">
            <p>{t.users.text}</p>
            <Link href="/admin/users" className={buttonClass.secondary}>
              {t.users.link}
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
