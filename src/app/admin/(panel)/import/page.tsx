import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { LegacyImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user.role, "import.run")) return <Forbidden />;
  const t = (await adminT()).importer;
  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title={t.title} />
          <LegacyImportForm />
        </Card>
        <Card>
          <CardHeader title={t.format} />
          <div className="space-y-3 p-5 text-sm text-slate-700">
            <p>{t.formatIntro}</p>
            <dl className="space-y-1.5">
              {t.columns.map(([name, desc]) => (
                <div key={name}>
                  <dt className="font-mono text-xs text-slate-900">{name}</dt>
                  <dd className="text-xs text-slate-500">{desc}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-500">{t.allOrNothing}</p>
          </div>
        </Card>
      </div>
    </>
  );
}
