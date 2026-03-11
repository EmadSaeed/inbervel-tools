-- Add formId column to ActionTool (nullable to avoid breaking existing rows)
ALTER TABLE "ActionTool" ADD COLUMN "formId" TEXT;

-- Unique constraint on (userEmail, formId) — NULL != NULL in PostgreSQL so multiple null-formId rows are still allowed
CREATE UNIQUE INDEX "ActionTool_userEmail_formId_key" ON "ActionTool"("userEmail", "formId");

-- Create CognitoForm table
CREATE TABLE "CognitoForm" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "formUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CognitoForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CognitoForm_key_key" ON "CognitoForm"("key");
CREATE UNIQUE INDEX "CognitoForm_formId_key" ON "CognitoForm"("formId");
