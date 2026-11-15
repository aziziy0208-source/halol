"use client";

/**
 * Shows certificate HTML exactly as the PDF renderer sees it. The frame is
 * sandboxed (scripts only, opaque origin): the template's layout script runs,
 * but it can neither read the admin page nor its cookies.
 */
export function CertificatePreview({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-scripts"
      className="h-[78vh] min-h-[480px] w-full rounded-md border border-slate-200 bg-slate-200"
    />
  );
}
