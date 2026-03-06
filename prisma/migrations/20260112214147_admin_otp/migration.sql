-- CreateTable
CREATE TABLE "AdminOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminOtp_email_idx" ON "AdminOtp"("email");

-- CreateIndex
CREATE INDEX "AdminOtp_expiresAt_idx" ON "AdminOtp"("expiresAt");
