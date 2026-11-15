import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const user = await requireUser();
  if (!can(user.role, "company.create")) return <Forbidden />;
  const t = (await adminT()).companies;
  return (
    <>
      <Link href="/admin/companies" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.back}
      </Link>
      <PageHeader title={t.createTitle} />
      <Card className="max-w-3xl">
        <CompanyForm />
      </Card>
    </>
  );
}
