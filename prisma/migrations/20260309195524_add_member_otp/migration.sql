-- CreateTable
CREATE TABLE "MemberOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberOtp_email_idx" ON "MemberOtp"("email");

-- CreateIndex
CREATE INDEX "MemberOtp_expiresAt_idx" ON "MemberOtp"("expiresAt");
