-- CreateTable
CREATE TABLE "CognitoSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formTitle" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "userEmail" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "entryCreatedAt" TIMESTAMP(3),
    "entryUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CognitoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CognitoSubmission_userEmail_idx" ON "CognitoSubmission"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CognitoSubmission_formId_userEmail_key" ON "CognitoSubmission"("formId", "userEmail");
