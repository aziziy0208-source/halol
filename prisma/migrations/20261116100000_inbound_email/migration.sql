-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "messageId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "to" TEXT[],
    "cc" TEXT[],
    "replyTo" TEXT[],
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "attachments" JSONB NOT NULL,
    "spf" TEXT,
    "dkim" TEXT,
    "dmarc" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_providerId_key" ON "InboundEmail"("providerId");

-- CreateIndex
CREATE INDEX "InboundEmail_receivedAt_idx" ON "InboundEmail"("receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_isRead_receivedAt_idx" ON "InboundEmail"("isRead", "receivedAt");
