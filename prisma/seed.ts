/**
 * Seed: settings, standards, the first SUPER_ADMIN and (optionally) demo data.
 * Idempotent — safe to run repeatedly; existing rows are left untouched.
 *
 *   SEED_SUPERADMIN_EMAIL / _NAME / _PASSWORD  first admin (password never in repo)
 *   SEED_DEMO=true                             demo company + 3 test certificates
 */
import "dotenv/config";
import type { CertificateStatus, Prisma } from "@/generated/prisma/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { DEFAULT_NUMBER_FORMAT, formatCertificateNumber } from "@/lib/certificates/number";
import { type CertificateSnapshot, toIsoDate } from "@/lib/certificates/snapshot";
import { createPrismaClient } from "@/lib/prisma-client";
import { generatePublicToken, randomBase62 } from "@/lib/tokens";
import { CURRENT_TEMPLATE_VERSION } from "@/certificates/templates";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const prisma = createPrismaClient(databaseUrl);
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function seedSettings() {
  const defaults: Record<string, Prisma.InputJsonValue> = {
    "certificate.numberFormat": DEFAULT_NUMBER_FORMAT,
    "certificate.defaultValidityMonths": 12,
    "certificate.fourEyes": true,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

async function seedStandards() {
  const standards = [
    { code: "OIC/SMIIC 1:2019", title: "General Requirements for Halal Food" },
    { code: "MS 1500:2019", title: "Halal Food – General Requirements (Malaysia, JAKIM)" },
  ];
  for (const s of standards) {
    await prisma.standard.upsert({ where: { code: s.code }, create: s, update: {} });
  }
}

async function seedSuperAdmin() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) throw new Error("SEED_SUPERADMIN_EMAIL is not set");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• Super admin ${email} already exists — unchanged.`);
    return existing;
  }

  let password = process.env.SEED_SUPERADMIN_PASSWORD ?? "";
  const generated = !password;
  if (generated) password = randomBase62(20);
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_SUPERADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: process.env.SEED_SUPERADMIN_NAME?.trim() || "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      after: { email, role: user.role, source: "seed" },
    },
  });

  console.log(`• Super admin created: ${email}`);
  if (generated) {
    console.log(`  Generated password (shown once, change it after first login): ${password}`);
  }
  return user;
}

type DemoCertificate = {
  year: number;
  sequence: number;
  status: CertificateStatus;
  scope: string;
  category: string;
  issueDate: string;
  validUntil: string;
  auditDate: string;
  revokedAt?: string;
  revokeReason?: string;
  label: string;
  products: { name: string; brand: string; articleNo: string }[];
};

const DEMO_CERTIFICATES: DemoCertificate[] = [
  {
    label: "active",
    year: 2026,
    sequence: 1,
    status: "ACTIVE",
    scope: "Herstellung und Verpackung von Geflügelwurstwaren",
    category: "Lebensmittel – tierischen Ursprungs",
    issueDate: "2026-03-02",
    validUntil: "2027-03-01",
    auditDate: "2026-02-20",
    products: [
      { name: "Geflügel-Wiener", brand: "Muster Halal", articleNo: "MH-1001" },
      { name: "Geflügel-Salami", brand: "Muster Halal", articleNo: "MH-1002" },
      { name: "Hähnchen-Brustfilet, gegart", brand: "Muster Halal", articleNo: "MH-1003" },
    ],
  },
  {
    label: "expired",
    year: 2024,
    sequence: 1,
    status: "ACTIVE", // EXPIRED is derived from validUntil, never stored
    scope: "Herstellung von Backwaren",
    category: "Lebensmittel – pflanzlichen Ursprungs",
    issueDate: "2024-09-16",
    validUntil: "2025-09-15",
    auditDate: "2024-09-05",
    products: [{ name: "Fladenbrot", brand: "Muster Backhaus", articleNo: "MB-2001" }],
  },
  {
    label: "revoked",
    year: 2026,
    sequence: 2,
    status: "REVOKED",
    scope: "Herstellung von Süßwaren",
    category: "Lebensmittel – pflanzlichen Ursprungs",
    issueDate: "2026-05-04",
    validUntil: "2027-05-03",
    auditDate: "2026-04-22",
    revokedAt: "2026-08-12",
    revokeReason: "Nichteinhaltung der Halal-Anforderungen beim Überwachungsaudit",
    products: [
      { name: "Fruchtgummi", brand: "Muster Süß", articleNo: "MS-3001" },
      { name: "Schaumzucker", brand: "Muster Süß", articleNo: "MS-3002" },
    ],
  },
];

async function seedDemo(adminId: string) {
  const company =
    (await prisma.company.findFirst({ where: { name: "Musterfirma Halal Foods GmbH" } })) ??
    (await prisma.company.create({
      data: {
        name: "Musterfirma Halal Foods GmbH",
        legalForm: "GmbH",
        address: "Musterstraße 12",
        postalCode: "80331",
        city: "München",
        country: "DE",
        registrationNo: "HRB 000000",
        contactPerson: "Erika Musterfrau",
        email: "qm@musterfirma.example",
        phone: "+49 89 0000000",
      },
    }));

  const signatory =
    (await prisma.signatory.findFirst({ where: { name: "Max Mustermann" } })) ??
    (await prisma.signatory.create({
      data: { name: "Max Mustermann", title: "Leiter der Zertifizierungsstelle" },
    }));

  const standard = await prisma.standard.findUniqueOrThrow({ where: { code: "OIC/SMIIC 1:2019" } });

  for (const demo of DEMO_CERTIFICATES) {
    const certificateNumber = formatCertificateNumber(demo.year, demo.sequence);
    const exists = await prisma.certificate.findUnique({
      where: { certificateNumber_revision: { certificateNumber, revision: 0 } },
    });
    if (exists) {
      console.log(`• ${certificateNumber} (${demo.label}) already exists — unchanged.`);
      continue;
    }

    const snapshot: CertificateSnapshot = {
      v: 1,
      certificateNumber,
      revision: 0,
      company: {
        name: company.name,
        legalForm: company.legalForm,
        address: company.address,
        postalCode: company.postalCode,
        city: company.city,
        country: company.country,
      },
      productionSite: null,
      scope: demo.scope,
      category: demo.category,
      standards: [{ code: standard.code, title: standard.title }],
      products: demo.products.map((p) => ({ ...p, description: null })),
      issueDate: demo.issueDate,
      validUntil: demo.validUntil,
      auditDate: demo.auditDate,
      signatory: { name: signatory.name, title: signatory.title },
    };

    const publicToken = generatePublicToken();
    const issuedAt = new Date(`${demo.issueDate}T09:00:00Z`);
    const certificate = await prisma.$transaction(async (tx) => {
      const created = await tx.certificate.create({
        data: {
          certificateNumber,
          revision: 0,
          publicToken,
          status: demo.status,
          companyId: company.id,
          scope: demo.scope,
          category: demo.category,
          issueDate: new Date(demo.issueDate),
          validUntil: new Date(demo.validUntil),
          auditDate: new Date(demo.auditDate),
          signatoryId: signatory.id,
          templateVersion: CURRENT_TEMPLATE_VERSION,
          snapshot,
          createdById: adminId,
          issuedById: adminId,
          issuedAt,
          revokedAt: demo.revokedAt ? new Date(`${demo.revokedAt}T10:00:00Z`) : null,
          revokeReason: demo.revokeReason ?? null,
          products: {
            create: demo.products.map((p, i) => ({ ...p, sortOrder: i })),
          },
          standards: { create: [{ standardId: standard.id }] },
        },
      });
      // Keep the yearly counter ahead of seeded numbers.
      await tx.$executeRaw`
        INSERT INTO "Counter" ("year", "lastNumber") VALUES (${demo.year}, ${demo.sequence})
        ON CONFLICT ("year") DO UPDATE
          SET "lastNumber" = GREATEST("Counter"."lastNumber", EXCLUDED."lastNumber")`;
      await tx.auditLog.create({
        data: {
          action: "certificate.create",
          entityType: "Certificate",
          entityId: created.id,
          after: { certificateNumber, status: demo.status, source: "seed-demo" },
        },
      });
      return created;
    });

    console.log(
      `• ${certificateNumber} (${demo.label}) → ${appUrl}/v/${certificate.publicToken}`,
    );
  }
}

async function main() {
  await seedSettings();
  await seedStandards();
  const admin = await seedSuperAdmin();
  if (process.env.SEED_DEMO === "true") {
    await seedDemo(admin.id);
  } else {
    console.log("• Demo data skipped (set SEED_DEMO=true to add it).");
  }
  console.log(`Seed finished (${toIsoDate(new Date())}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
