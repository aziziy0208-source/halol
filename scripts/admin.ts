/**
 * Emergency account tools for server operators (e.g. the only super admin lost
 * their phone or locked themselves out). Every command is written to the audit log.
 *
 *   npm run admin -- list
 *   npm run admin -- unlock <email>
 *   npm run admin -- reset-2fa <email>
 *   npm run admin -- reset-password <email>     prints a new temporary password once
 *
 * In Docker: docker compose run --rm migrate npx tsx scripts/admin.ts <command> [email]
 */
import "dotenv/config";
import { hashPassword } from "@/lib/auth/password";
import { createPrismaClient } from "@/lib/prisma-client";
import { randomBase62 } from "@/lib/tokens";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const prisma = createPrismaClient(databaseUrl);

const [command, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

async function findUser() {
  if (!email) throw new Error(`Usage: npm run admin -- ${command} <email>`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with e-mail ${email}`);
  return user;
}

async function log(action: string, userId: string) {
  await prisma.auditLog.create({
    data: { userId: null, action, entityType: "User", entityId: userId, after: { source: "cli", email } },
  });
}

async function main() {
  switch (command) {
    case "list": {
      const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
      for (const u of users) {
        const flags = [
          u.isActive ? "active" : "INACTIVE",
          u.totpEnabledAt ? "2fa" : "no-2fa",
          u.lockedUntil && u.lockedUntil > new Date() ? `LOCKED until ${u.lockedUntil.toISOString()}` : "",
        ].filter(Boolean);
        console.log(`${u.email.padEnd(36)} ${u.role.padEnd(12)} ${flags.join(", ")}`);
      }
      return;
    }
    case "unlock": {
      const user = await findUser();
      await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: null, failedLoginCount: 0 } });
      await log("cli.user.unlock", user.id);
      console.log(`Unlocked ${user.email}.`);
      return;
    }
    case "reset-2fa": {
      const user = await findUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: null, totpEnabledAt: null, totpLastUsedStep: null },
      });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await log("cli.user.2fa.reset", user.id);
      console.log(`2FA reset for ${user.email}. They set it up again at the next sign-in.`);
      return;
    }
    case "reset-password": {
      const user = await findUser();
      const temp = randomBase62(16);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(temp), mustChangePassword: true, lockedUntil: null, failedLoginCount: 0 },
      });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await log("cli.user.password.reset", user.id);
      console.log(`Temporary password for ${user.email} (shown once, must be changed at sign-in):\n${temp}`);
      return;
    }
    default:
      console.log("Commands: list | unlock <email> | reset-2fa <email> | reset-password <email>");
      process.exitCode = command ? 1 : 0;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
