-- AlterTable: add new profile columns to User
ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "companyLogoUrl" TEXT,
ADD COLUMN "companyWebsite" TEXT,
ADD COLUMN "position" TEXT;

-- Backfill first/last name from legacy "name" where available
UPDATE "User"
SET
  "firstName" = NULLIF(split_part(trim("name"), ' ', 1), ''),
  "lastName" = NULLIF(regexp_replace(trim("name"), '^\\S+\\s*', ''), '')
WHERE "name" IS NOT NULL;

-- Backfill company fields from latest CognitoSubmission per email
WITH latest_submission AS (
  SELECT DISTINCT ON ("userEmail")
    "userEmail",
    "companyName",
    "companyLogoDataUri"
  FROM "CognitoSubmission"
  ORDER BY "userEmail", "updatedAt" DESC
)
UPDATE "User" u
SET
  "companyName" = COALESCE(u."companyName", ls."companyName"),
  "companyLogoUrl" = COALESCE(u."companyLogoUrl", ls."companyLogoDataUri")
FROM latest_submission ls
WHERE u."email" = ls."userEmail";

-- Ensure email is present before making it required
UPDATE "User"
SET "email" = CONCAT('missing-email-', "id", '@local.invalid')
WHERE "email" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "email" SET NOT NULL;

-- Drop legacy User columns
ALTER TABLE "User"
DROP COLUMN "name",
DROP COLUMN "image";

-- AlterTable: CognitoSubmission now keeps raw payload and optional generated output PDF URL
ALTER TABLE "CognitoSubmission"
ADD COLUMN "outputPdfUrl" TEXT,
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "companyName",
DROP COLUMN "companyLogoDataUri";
