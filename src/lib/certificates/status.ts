import type { CertificateStatus } from "@/generated/prisma/enums";

/** What the public sees: the stored status plus EXPIRED, which is never stored (spec §6). */
export type EffectiveStatus = CertificateStatus | "EXPIRED";

export function effectiveStatus(
  status: CertificateStatus,
  validUntil: Date | null,
  today: Date,
): EffectiveStatus {
  if (status === "ACTIVE" && validUntil && validUntil.getTime() < today.getTime()) return "EXPIRED";
  return status;
}
