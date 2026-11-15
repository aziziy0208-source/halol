import type { Metadata } from "next";
import Link from "next/link";
import { CertificatePreview } from "@/components/admin/certificate-preview";
import { buttonClass, Card, PageHeader } from "@/components/admin/ui";
import { Forbidden } from "@/components/admin/forbidden";
import { adminT } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { parseVariant, SAMPLE_VARIANTS, sampleHtml } from "./sample";

export const metadata: Metadata = { title: "Certificate template" };

export default async function TemplatePreviewPage({ searchParams }: PageProps<"/admin/certificates/template">) {
  const user = await requireUser();
  if (!can(user.role, "certificate.view")) return <Forbidden />;
  const t = (await adminT()).certificates;
  const variant = parseVariant((await searchParams).variant);
  const html = await sampleHtml(variant, { assetBase: "", mode: "preview" });

  return (
    <>
      <Link href="/admin/certificates" className={`${buttonClass.link} mb-3 inline-block`}>
        ← {t.detail.back}
      </Link>
      <PageHeader title={t.template.title} subtitle={t.template.subtitle}>
        <a href={`/admin/certificates/template/files/sample.pdf?variant=${variant}`} className={buttonClass.primary}>
          {t.template.downloadPdf}
        </a>
      </PageHeader>
      <nav aria-label="Sample" className="mb-4 flex flex-wrap gap-2">
        {SAMPLE_VARIANTS.map((v) => (
          <Link
            key={v}
            href={`/admin/certificates/template?variant=${v}`}
            aria-current={v === variant ? "page" : undefined}
            className={v === variant ? buttonClass.primary : buttonClass.secondary}
          >
            {t.template.variants[v]}
          </Link>
        ))}
      </nav>
      <Card className="p-3">
        <CertificatePreview html={html} title={t.template.title} />
      </Card>
    </>
  );
}
