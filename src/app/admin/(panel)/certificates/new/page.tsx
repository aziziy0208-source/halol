import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { param } from "@/components/admin/pagination";
import { CertificateEditor } from "../_editor/certificate-editor";
import { loadEditorData } from "../_editor/load";

export const metadata: Metadata = { title: "New certificate" };

export default async function NewCertificatePage({ searchParams }: PageProps<"/admin/certificates/new">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.edit")) return <Forbidden />;
  const t = (await adminT());
  const company = param((await searchParams).company);
  const data = await loadEditorData(user, null, company || undefined);
  return (
    <>
      <Link href="/admin/certificates" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.certificates.detail.back}
      </Link>
      <PageHeader title={t.editor.newTitle} />
      <CertificateEditor data={data} />
    </>
  );
}
