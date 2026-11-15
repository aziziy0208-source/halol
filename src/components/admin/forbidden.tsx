import Link from "next/link";
import { adminT } from "@/i18n/admin/server";
import { buttonClass, Card } from "./ui";

/** Shown instead of a page the signed-in role may not open. */
export async function Forbidden() {
  const t = (await adminT()).forbidden;
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <h1 className="mb-2 font-sans text-xl font-semibold text-slate-900">{t.title}</h1>
      <p className="mb-6 text-sm text-slate-600">{t.text}</p>
      <Link href="/admin" className={buttonClass.secondary}>
        {t.back}
      </Link>
    </Card>
  );
}
