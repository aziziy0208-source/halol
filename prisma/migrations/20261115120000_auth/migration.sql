-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpLastUsedStep" INTEGER;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "pendingTotpSecret" TEXT;

