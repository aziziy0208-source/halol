import type { EffectiveStatus } from "@/lib/certificates/status";
import { adminT } from "@/i18n/admin/server";
import { Badge } from "./ui";

const TONE: Record<EffectiveStatus, "green" | "neutral" | "amber" | "red" | "blue"> = {
  ACTIVE: "green",
  EXPIRED: "neutral",
  SUSPENDED: "amber",
  REVOKED: "red",
  SUPERSEDED: "blue",
  DRAFT: "neutral",
  PENDING_APPROVAL: "blue",
};

export async function CertificateStatusBadge({ status }: { status: EffectiveStatus }) {
  return <Badge tone={TONE[status]}>{(await adminT()).certificates.statuses[status]}</Badge>;
}
