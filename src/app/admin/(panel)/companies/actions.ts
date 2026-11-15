"use server";

import { refresh } from "next/cache";
import { companyFieldsSchema } from "@/certificates/draft-schema";
import { storeCompanyLogo } from "@/certificates/images";
import { adminT } from "@/i18n/admin/server";
import { type ActionState, actionContext, errorState, text } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const FIELDS = ["name", "legalForm", "address", "postalCode", "city", "country", "registrationNo", "contactPerson", "email", "phone"] as const;

/** Create (permission company.create) or update (company.edit) a company. */
export async function saveCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).companies;
  const id = text(formData, "id");
  const access = await actionContext(id ? "company.edit" : "company.create");
  if (!access.ok) return access.state;

  const parsed = companyFieldsSchema.safeParse(Object.fromEntries(FIELDS.map((f) => [f, text(formData, f)])));
  if (!parsed.success) return { status: "error", message: t.invalid };
  const data = parsed.data;
  const logo = formData.get("logo");
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
  const removeLogo = formData.get("removeLogo") === "on";

  try {
    const before = id ? await prisma.company.findUnique({ where: { id } }) : null;
    if (id && !before) return { status: "error", message: t.notFound };
    const company = before
      ? await prisma.company.update({ where: { id: before.id }, data })
      : await prisma.company.create({ data });

    // Logo: stored privately (re-encoded PNG); issued certificates keep the key they were issued with.
    let logoImageKey = before?.logoImageKey ?? null;
    let logoError = false;
    if (logoFile) {
      const key = await storeCompanyLogo(company.id, logoFile);
      if (key) logoImageKey = key;
      else logoError = true;
    } else if (removeLogo) {
      logoImageKey = null;
    }
    if (logoImageKey !== (before?.logoImageKey ?? null)) {
      await prisma.company.update({ where: { id: company.id }, data: { logoImageKey } });
    }

    await audit({
      userId: access.ctx.actorId,
      action: before ? "company.update" : "company.create",
      entityType: "Company",
      entityId: company.id,
      before: before ? { ...Object.fromEntries(FIELDS.map((f) => [f, before[f]])), logoImageKey: before.logoImageKey } : undefined,
      after: { ...data, logoImageKey },
      ipHash: access.ctx.ipHash,
    });
    if (logoError) {
      if (!before) return { status: "success", message: t.badLogo, redirectTo: `/admin/companies/${company.id}?logo=invalid` };
      refresh();
      return { status: "error", message: t.badLogo };
    }
    if (before) {
      refresh();
      return { status: "success", message: t.saved };
    }
    return { status: "success", message: t.saved, redirectTo: `/admin/companies/${company.id}` };
  } catch (error) {
    return errorState(error);
  }
}

/** Companies can only be deleted while no certificate (not even a draft) refers to them. */
export async function deleteCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).companies;
  const access = await actionContext("company.edit");
  if (!access.ok) return access.state;
  const id = text(formData, "id");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id }, include: { _count: { select: { certificates: true } } } });
      if (!company) return "missing" as const;
      if (company._count.certificates > 0) return "inUse" as const;
      await tx.company.delete({ where: { id } });
      await audit(
        {
          userId: access.ctx.actorId,
          action: "company.delete",
          entityType: "Company",
          entityId: id,
          before: Object.fromEntries(FIELDS.map((f) => [f, company[f]])),
          ipHash: access.ctx.ipHash,
        },
        tx,
      );
      return "deleted" as const;
    });
    if (result === "missing") return { status: "error", message: t.notFound };
    if (result === "inUse") return { status: "error", message: t.cannotRemove };
    return { status: "success", message: t.removed, redirectTo: "/admin/companies" };
  } catch (error) {
    return errorState(error);
  }
}
