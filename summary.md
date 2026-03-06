# Inbervel Tools — Codebase Summary

## Overview

A Next.js 16 web application that serves as a **"Profit-Pilot" Business Plan Generator** for Inbervel. It collects structured client data via Cognito Forms webhooks, stores it in a PostgreSQL database, and allows admins to generate a formatted PDF business plan for any client.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth v4 (JWT sessions, OTP-based credentials) |
| PDF Generation | Puppeteer (local) / puppeteer-core + Sparticuz Chromium (Vercel) |
| Templating | Handlebars (`.hbs`) + custom CSS |
| File Storage | Vercel Blob |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Email | Nodemailer |

---

## Architecture

### Data Ingestion — Cognito Webhook
- **`POST /api/webhooks/cognito`** receives form submissions from Cognito Forms, authenticated by a shared secret token (`COGNITO_WEBHOOK_TOKEN`).
- `cognitoSubmissionHandler` parses the payload, extracts client info (name, email, company, form ID), and upserts a `CognitoSubmission` row in the database.
- For form ID `29` (the final form), the company logo file is downloaded from Cognito and stored permanently in Vercel Blob (`cognito-uploads/...`).

### Database Models (Prisma)
- **`CognitoSubmission`** — stores each form submission keyed by `(formId, userEmail)`. Contains the full JSON payload and an optional `companyLogoDataUri` (Blob URL).
- **`AllowedAdminEmail`** — allowlist of emails permitted to log in as admin.
- **`AdminOtp`** — one-time passcodes (SHA-256 hashed) for admin login, with expiry tracking.
- **`User`, `Account`, `Session`, `VerificationToken`** — standard NextAuth models.

### Admin Portal
- **`/admin`** — protected dashboard (redirects to `/admin/login` if unauthenticated).
  - Search for a client by email.
  - View which of the 10 required Cognito forms have been submitted.
  - Generate and download the business plan PDF when all forms are present.
- **`/admin/login`** — OTP login page. Admin requests a code sent to their email; code is verified against the `AdminOtp` table.

### PDF Generation Pipeline
1. **`buildBusinessPlanTemplateDto`** — queries all 10 required form submissions for a client and assembles a typed DTO.
2. **`renderBusinessPlanTemplate`** — renders a Handlebars template (`business-plan.hbs`) with the DTO, inlining CSS and the risk chart image as base64.
3. **`htmlToPdfBuffer`** — launches a headless Chromium browser to print the HTML to PDF with custom headers/footers and page numbering.
4. The PDF is streamed back to the browser as a file download.

### Required Forms (10 total)
| Form ID | Topic |
|---|---|
| 8 | Objectives |
| 11 | Competitive Advantage |
| 12 | SWOT Analysis |
| 14 | Offerings Prioritisation |
| 15 | Client Targeting / Sectors |
| 16 | Route to Market |
| 23 | Labour Rates Card |
| 25 | Financial Forecast |
| 29 | Final Reflections & Summary (also collects company logo) |
| 39 | Risk Identification |

---

## Authentication

- OTP-based: admins request a one-time code via `POST /api/otp/request-code`, delivered by email (Nodemailer).
- Login validates the SHA-256 hash of the code against the `AdminOtp` table, checks expiry and that the email is in the `AllowedAdminEmail` allowlist.
- Sessions are JWT-based with a 30-day max age.

---

## Key Files

| Path | Purpose |
|---|---|
| [auth.ts](auth.ts) | NextAuth configuration and OTP credential provider |
| [lib/cognitoSubmissionHandler.ts](lib/cognitoSubmissionHandler.ts) | Webhook payload parser and DB upsert logic |
| [lib/buildBusinessPlanTemplateDto.ts](lib/buildBusinessPlanTemplateDto.ts) | Assembles data for the PDF template |
| [lib/pdf/renderTemplate.ts](lib/pdf/renderTemplate.ts) | Handlebars rendering |
| [lib/pdf/generatePdf.ts](lib/pdf/generatePdf.ts) | Puppeteer HTML-to-PDF conversion |
| [lib/forms/requiredForms.ts](lib/forms/requiredForms.ts) | Canonical list of required Cognito form IDs |
| [lib/templates/business-plan.hbs](lib/templates/business-plan.hbs) | PDF HTML template |
| [prisma/schema.prisma](prisma/schema.prisma) | Database schema |
| [app/admin/page.tsx](app/admin/page.tsx) | Admin dashboard UI |
| [app/api/webhooks/cognito/route.ts](app/api/webhooks/cognito/route.ts) | Cognito webhook endpoint |
| [app/api/admin/generate-business-plan/route.ts](app/api/admin/generate-business-plan/route.ts) | PDF generation endpoint |

---

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — NextAuth session secret
- `COGNITO_WEBHOOK_TOKEN` — shared secret for webhook auth
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token for logo uploads
- `CHROMIUM_BLOB_PACK_URL` / `CHROMIUM_GITHUB_PACK_URL` — Chromium binary URLs for Vercel deployment
- SMTP credentials for Nodemailer (OTP email delivery)
