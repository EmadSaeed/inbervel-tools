# GPT Codebase Summary: inbervel-tools

## What This Project Is
`inbervel-tools` is a Next.js 16 (App Router) internal admin tool for generating client business-plan PDFs.

Core workflow:
1. Cognito Forms sends webhook submissions.
2. Submissions are stored in Postgres via Prisma.
3. Admin signs in with email OTP.
4. Admin checks whether required forms are complete for a client.
5. System builds HTML (Handlebars) and renders PDF (Puppeteer/Chromium).

## Stack
- Framework: Next.js 16, React 19, TypeScript
- Data: Prisma + PostgreSQL
- Auth: NextAuth credentials provider with OTP
- Email: Nodemailer SMTP
- PDF: Handlebars template + Puppeteer (`puppeteer` local, `puppeteer-core` + `@sparticuz/chromium-min` on Vercel)
- File storage: Vercel Blob (company logos)

## Main Runtime Flows

### 1) Cognito ingestion
- Endpoint: `POST /api/webhooks/cognito?token=...`
- Auth: shared secret `COGNITO_WEBHOOK_TOKEN`
- Handler: [`lib/cognitoSubmissionHandler.ts`](/Users/emad/Desktop/inbervel-tools/lib/cognitoSubmissionHandler.ts)
- Behavior:
  - extracts form/user metadata and payload
  - normalizes email
  - upserts by unique key `(formId, userEmail)`
  - for form `29`, downloads uploaded logo from Cognito URL and stores it in Vercel Blob; saves permanent URL to `companyLogoDataUri`

### 2) Admin authentication
- Login page: `/admin/login`
- Request code endpoint: `POST /api/otp/request-code`
- Auth backend: NextAuth credentials provider in [`auth.ts`](/Users/emad/Desktop/inbervel-tools/auth.ts)
- Security model:
  - only emails in `AllowedAdminEmail` can receive usable access
  - OTP codes are hashed (SHA-256) in DB, 10-minute expiry, one-time use (`usedAt` set after login)
  - unknown emails return `{ ok: true }` to reduce account enumeration

### 3) Admin client status and PDF generation
- Status endpoint: `GET /api/admin/submissions?email=...`
  - returns required form checklist + `readyToGenerate`
- Generate endpoint: `POST /api/admin/generate-business-plan`
  - loads required forms for that email
  - builds DTO with `buildBusinessPlanTemplateDto`
  - renders HTML from `lib/templates/business-plan.hbs` + CSS
  - converts HTML to PDF via Puppeteer
  - returns downloadable PDF named `"<Company> Business Plan.pdf"`

## Required Business-Plan Forms
Defined in [`lib/forms/requiredForms.ts`](/Users/emad/Desktop/inbervel-tools/lib/forms/requiredForms.ts). The app requires 10 form IDs:
`14, 15, 8, 11, 16, 12, 23, 39, 25, 29`

If any are missing, PDF generation is blocked and backend throws `Missing required forms: ...`.

## Database Model Summary
From [`prisma/schema.prisma`](/Users/emad/Desktop/inbervel-tools/prisma/schema.prisma):
- `CognitoSubmission`: one row per `(formId, userEmail)` with raw JSON payload
- `AllowedAdminEmail`: admin allowlist
- `AdminOtp`: hashed OTP codes with expiry/usage
- `User/Account/Session/VerificationToken`: NextAuth tables

## Frontend Structure
- `/` redirects to `/admin`
- `/admin/login` handles OTP request + verification
- `/admin` dashboard:
  - searches by client email
  - displays required forms completion and submission dates
  - triggers PDF generation download
- Session handling via `SessionProvider` in [`app/providers.tsx`](/Users/emad/Desktop/inbervel-tools/app/providers.tsx)

## Notable Implementation Observations
- `README.md` is still default Next.js boilerplate and does not describe real project behavior.
- There is a secondary endpoint `POST /api/pdf` with empty zod schema (`z.object({})`) in [`app/api/pdf/schema.ts`](/Users/emad/Desktop/inbervel-tools/app/api/pdf/schema.ts); this looks like an old/test route and is not used by the admin flow.
- [`lib/uploadCompanyLogo.ts`](/Users/emad/Desktop/inbervel-tools/lib/uploadCompanyLogo.ts) appears unused; logo upload logic is currently duplicated inline inside `cognitoSubmissionHandler.ts`.

## Environment Variables You Need
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `COGNITO_WEBHOOK_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `CHROMIUM_BLOB_PACK_URL` and/or `CHROMIUM_GITHUB_PACK_URL` (for Vercel PDF runtime)
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `AUTH_EMAIL_FROM` (or `EMAIL_FROM`)
