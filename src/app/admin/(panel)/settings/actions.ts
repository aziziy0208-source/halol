"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type SignatoryImageKind, storeSignatoryImage } from "@/certificates/images";
import { adminT } from "@/i18n/admin/server";
import { type ActionState, actionContext, errorState, text } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { saveSettings, settingsSchema } from "@/lib/settings";

/** Settings are SUPER_ADMIN only (permission "settings.manage"), re-checked in every action. */

export async function saveGeneralSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).settings.general;
  const access = await actionContext("settings.manage");
  if (!access.ok) return access.state;
  const parsed = settingsSchema.safeParse({
    numberFormat: text(formData, "numberFormat").trim(),
    defaultValidityMonths: Number(text(formData, "defaultValidityMonths")),
    fourEyes: formData.get("fourEyes") === "on",
  });
  if (!parsed.success) return { status: "error", message: t.invalid };
  try {
    await saveSettings(parsed.data, access.ctx.actorId, access.ctx.ipHash);
  } catch (error) {
    return errorState(error);
  }
  refresh();
  return { status: "success", message: t.saved };
}

// ─── Standards ──────────────────────────────────────────────────────────────

const standardSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(300),
});

export async function saveStandardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).settings.standards;
  const access = await actionContext("settings.manage");
  if (!access.ok) return access.state;
  const parsed = standardSchema.safeParse({
    id: text(formData, "id") || undefined,
    code: text(formData, "code"),
    title: text(formData, "title"),
  });
  if (!parsed.success) return { status: "error", message: t.invalid };
  const { id, code, title } = parsed.data;

  const clash = await prisma.standard.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (clash) return { status: "error", message: t.codeTaken };

  try {
    if (id) {
      const before = await prisma.standard.findUnique({ where: { id } });
      if (!before) return { status: "error", message: t.invalid };
      await prisma.standard.update({ where: { id }, data: { code, title } });
      await audit({
        userId: access.ctx.actorId,
        action: "standard.update",
        entityType: "Standard",
        entityId: id,
        before: { code: before.code, title: before.title },
        after: { code, title },
        ipHash: access.ctx.ipHash,
      });
    } else {
      const created = await prisma.standard.create({ data: { code, title } });
      await audit({
        userId: access.ctx.actorId,
        action: "standard.create",
        entityType: "Standard",
        entityId: created.id,
        after: { code, title },
        ipHash: access.ctx.ipHash,
      });
    }
  } catch (error) {
    return errorState(error);
  }
  refresh();
  return { status: "success", message: t.saved };
}

export async function toggleStandardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext("settings.manage");
  if (!access.ok) return access.state;
  const id = text(formData, "id");
  const isActive = text(formData, "active") === "1";
  const updated = await prisma.standard.updateMany({ where: { id }, data: { isActive } });
  if (updated.count === 1) {
    await audit({
      userId: access.ctx.actorId,
      action: isActive ? "standard.activate" : "standard.deactivate",
      entityType: "Standard",
      entityId: id,
      ipHash: access.ctx.ipHash,
    });
  }
  refresh();
  return { status: "success", message: (await adminT()).settings.standards.saved };
}

// ─── Signatories ────────────────────────────────────────────────────────────

const signatorySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
});

function uploaded(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveSignatoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = (await adminT()).settings.signatories;
  const access = await actionContext("settings.manage");
  if (!access.ok) return access.state;
  const parsed = signatorySchema.safeParse({
    id: text(formData, "id") || undefined,
    name: text(formData, "name"),
    title: text(formData, "title"),
  });
  if (!parsed.success) return { status: "error", message: t.invalid };
  const { id, name, title } = parsed.data;
  const files: [SignatoryImageKind, File | null][] = [
    ["signature", uploaded(formData, "signature")],
    ["stamp", uploaded(formData, "stamp")],
  ];

  try {
    const before = id ? await prisma.signatory.findUnique({ where: { id } }) : null;
    if (id && !before) return { status: "error", message: t.invalid };
    const signatory = before
      ? await prisma.signatory.update({ where: { id: before.id }, data: { name, title } })
      : await prisma.signatory.create({ data: { name, title } });

    const imageKeys: { signatureImageKey?: string; stampImageKey?: string } = {};
    for (const [kind, file] of files) {
      if (!file) continue;
      const key = await storeSignatoryImage(signatory.id, kind, file);
      if (!key) {
        // A new signatory without its rejected image is still saved; the user retries the upload.
        refresh();
        return { status: "error", message: t.badImage };
      }
      imageKeys[kind === "signature" ? "signatureImageKey" : "stampImageKey"] = key;
    }
    if (Object.keys(imageKeys).length) await prisma.signatory.update({ where: { id: signatory.id }, data: imageKeys });

    await audit({
      userId: access.ctx.actorId,
      action: before ? "signatory.update" : "signatory.create",
      entityType: "Signatory",
      entityId: signatory.id,
      before: before ? { name: before.name, title: before.title } : undefined,
      after: { name, title, ...imageKeys },
      ipHash: access.ctx.ipHash,
    });
  } catch (error) {
    return errorState(error);
  }
  refresh();
  return { status: "success", message: t.saved };
}

const SIGNATORY_OPS = ["activate", "deactivate", "removeSignature", "removeStamp"] as const;

export async function signatoryOpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext("settings.manage");
  if (!access.ok) return access.state;
  const op = z.enum(SIGNATORY_OPS).safeParse(text(formData, "op"));
  const id = text(formData, "id");
  if (!op.success || !id) return { status: "error", message: (await adminT()).settings.signatories.invalid };
  const data = {
    activate: { isActive: true },
    deactivate: { isActive: false },
    // Only the reference is removed: issued certificates keep their own copy of the key.
    removeSignature: { signatureImageKey: null },
    removeStamp: { stampImageKey: null },
  }[op.data];
  const updated = await prisma.signatory.updateMany({ where: { id }, data });
  if (updated.count === 1) {
    await audit({
      userId: access.ctx.actorId,
      action: `signatory.${op.data}`,
      entityType: "Signatory",
      entityId: id,
      ipHash: access.ctx.ipHash,
    });
  }
  refresh();
  return { status: "success", message: (await adminT()).settings.signatories.saved };
}
