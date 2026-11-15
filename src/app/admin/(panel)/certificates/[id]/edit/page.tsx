import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonClass, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { findCertificate, isUnissued } from "@/certificates/load";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { CertificateEditor } from "../../_editor/certificate-editor";
import { loadEditorData } from "../../_editor/load";

export const metadata: Metadata = { title: "Edit draft" };

export default async function EditCertificatePage({ params }: PageProps<"/admin/certificates/[id]/edit">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.edit")) return <Forbidden />;
  const { id } = await params;
  const cert = await findCertificate(id);
  if (!cert) notFound();
  // Issued certificates are never edited; corrections go through a new revision.
  if (!isUnissued(cert.status)) redirect(`/admin/certificates/${id}`);
  const t = (await adminT());
  const data = await loadEditorData(user, cert);
  const title = cert.certificateNumber ? `${t.editor.editTitle}: ${cert.certificateNumber} / Rev. ${cert.revision}` : t.editor.editTitle;
  return (
    <>
      <Link href={`/admin/certificates/${id}`} className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.certificates.detail.back}
      </Link>
      <PageHeader title={title} />
      <CertificateEditor data={data} />
    </>
  );
}
