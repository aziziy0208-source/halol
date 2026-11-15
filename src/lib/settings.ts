import "server-only";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { DEFAULT_NUMBER_FORMAT, isValidNumberFormat } from "@/lib/certificates/number";
import { prisma } from "@/lib/db";

/** Admin-editable application settings (Setting table, key → JSON value). */
const KEYS = {
  numberFormat: "certificate.numberFormat",
  defaultValidityMonths: "certificate.defaultValidityMonths",
  fourEyes: "certificate.fourEyes",
} as const;

export const settingsSchema = z.object({
  numberFormat: z.string().refine(isValidNumberFormat, "Invalid number format"),
  defaultValidityMonths: z.number().int().min(1).max(60),
  /** Four-eyes principle: the person who issues a certificate must not be its creator. */
  fourEyes: z.boolean(),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  numberFormat: DEFAULT_NUMBER_FORMAT,
  defaultValidityMonths: 12,
  fourEyes: true,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const candidate = {
    numberFormat: byKey.get(KEYS.numberFormat) ?? DEFAULT_SETTINGS.numberFormat,
    defaultValidityMonths: byKey.get(KEYS.defaultValidityMonths) ?? DEFAULT_SETTINGS.defaultValidityMonths,
    fourEyes: byKey.get(KEYS.fourEyes) ?? DEFAULT_SETTINGS.fourEyes,
  };
  const parsed = settingsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(next: AppSettings, actorId: string, ipHash: string | null): Promise<void> {
  const before = await getSettings();
  await prisma.$transaction(
    (Object.keys(KEYS) as (keyof AppSettings)[]).map((name) =>
      prisma.setting.upsert({
        where: { key: KEYS[name] },
        create: { key: KEYS[name], value: next[name], updatedById: actorId },
        update: { value: next[name], updatedById: actorId },
      }),
    ),
  );
  await audit({ userId: actorId, action: "settings.update", entityType: "Setting", entityId: "certificate", before, after: next, ipHash });
}

export { addMonths } from "@/lib/dates";
