-- Replace partial unique index with a full unique index so Prisma's upsert ON CONFLICT works correctly.
-- PostgreSQL's ON CONFLICT clause requires a full (non-partial) unique index.
DROP INDEX IF EXISTS "ActionTool_userEmail_formId_key";
CREATE UNIQUE INDEX "ActionTool_userEmail_formId_key" ON "ActionTool"("userEmail", "formId");
