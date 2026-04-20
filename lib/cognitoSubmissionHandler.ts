import { prisma } from "@/lib/prisma";
import { handleNext90DaysActions } from "@/lib/handleNext90DaysActions";
import { extractFromCognito, getString, normaliseEmail, parseName, getCompanyLogo, getLatestDocumentUrl, safeKeyPart } from "@/lib/cognito/utils";
import { uploadRemoteFileToBlob, uploadLogoToBlob } from "@/lib/cognito/blobUpload";
import { handleCashFlow } from "@/lib/cognito/cashFlow";
import { handleFinancialMetrics, handleFinancialBudgets, upsertFinancialMetric } from "@/lib/cognito/financialMetrics";
import { handleFinancialPeriod } from "@/lib/cognito/financialPeriods";
import { recalculateProductivityPercentage } from "@/lib/cognito/productivity";
import { FORM_ID_OBJECTIVES, FORM_ID_FINAL, FORM_ID_FINANCIAL, FORM_ID_CASH_FLOW } from "@/lib/forms/formIds";

// Main entry point called by the webhook route.
// Parses the incoming Cognito payload, optionally uploads the company logo,
// then upserts the submission into the database (insert on first submit, update on re-submit).
export async function cognitoSubmissionHandler(payload: any) {
  const data = extractFromCognito(payload);
  const userEmail = normaliseEmail(data.userEmail);
  const companyName = getString(payload?.CompanyName);
  const parsedName = parseName(payload?.Name);
  const phone = getString(payload?.PhoneNumber);
  const companyWebsite = getString(payload?.CompanyWebsite);
  const position = getString(payload?.YourPosition) ?? getString(payload?.JobTitle);

  // Upsert: if a row already exists for this (formId, userEmail) pair, update it;
  // otherwise create a new row. This handles clients who re-submit a form.
  // Submissions are keyed by (formId, userEmail), so re-submits update the same row.
  await prisma.cognitoSubmission.upsert({
    where: {
      formId_userEmail: { formId: data.formId, userEmail: data.userEmail },
    },
    create: {
      formId: data.formId,
      formTitle: data.formTitle,
      userEmail,
      entryCreatedAt: data.entryCreatedAt,
      entryUpdatedAt: data.entryUpdatedAt,
      payload,
    },
    update: {
      formTitle: data.formTitle,
      entryCreatedAt: data.entryCreatedAt,
      entryUpdatedAt: data.entryUpdatedAt,
      payload,
    },
  });

  await prisma.user.upsert({
    where: { email: userEmail },
    create: {
      email: userEmail,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      companyName,
      phone,
      companyWebsite,
      position,
    },
    update: {
      ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
      ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
      ...(companyName ? { companyName } : {}),
      ...(phone ? { phone } : {}),
      ...(companyWebsite ? { companyWebsite } : {}),
      ...(position ? { position } : {}),
    },
  });

  console.log("[cognitoHandler] formId received:", JSON.stringify(data.formId));

  if (data.formId === FORM_ID_OBJECTIVES) {
    await handleNext90DaysActions(userEmail, payload);

    const targetFigure = payload?.Pillar2Operations?.Target ?? null;
    if (targetFigure !== null) {
      await prisma.productivityRecord.upsert({
        where: { userEmail },
        update: { targetFigure, recordedAt: new Date() },
        create: { userEmail, percentage: 0, targetFigure, recordedAt: new Date() },
      });
      await recalculateProductivityPercentage(userEmail);
    }
  }

  // Look up whether this form is a known business-plan form so we can upsert ActionTool.
  const knownForm = await prisma.cognitoForm.findUnique({
    where: { formId: data.formId },
  });

  const latestDocumentUrl = getLatestDocumentUrl(payload);
  let pdfBlobUrl: string | null = null;

  if (latestDocumentUrl) {
    try {
      const nsEmail = safeKeyPart(userEmail) || "unknown-email";
      const nsFormId = safeKeyPart(data.formId) || "unknown-form";
      const fileTitle =
        safeKeyPart(data.formTitle || `form-${data.formId}`) ||
        `form-${data.formId}`;
      const pathname = `user-uploads/${nsEmail}/${nsFormId}/${fileTitle}.pdf`;

      pdfBlobUrl = await uploadRemoteFileToBlob({
        fileUrl: latestDocumentUrl,
        pathname,
        contentTypeHint: "application/pdf",
      });

      await prisma.cognitoSubmission.update({
        where: {
          formId_userEmail: { formId: data.formId, userEmail },
        },
        data: { outputPdfUrl: pdfBlobUrl },
      });
    } catch (error) {
      console.warn("Document upload failed; submission row kept.", {
        formId: data.formId,
        userEmail,
        error,
      });
    }
  }

  // Upsert ActionTool for any known business-plan form submission.
  if (knownForm) {
    try {
      await prisma.actionTool.upsert({
        where: { userEmail_formId: { userEmail, formId: data.formId } },
        create: {
          userEmail,
          formId: data.formId,
          label: knownForm.title,
          status: "COMPLETE",
          buttonType: pdfBlobUrl ? "DOWNLOAD" : "COMPLETE",
          fileUrl: pdfBlobUrl,
          sortOrder: knownForm.sortOrder,
        },
        update: {
          status: "COMPLETE",
          buttonType: pdfBlobUrl ? "DOWNLOAD" : "COMPLETE",
          fileUrl: pdfBlobUrl,
          label: knownForm.title,
        },
      });
    } catch (error) {
      console.warn("ActionTool upsert failed; continuing.", {
        formId: data.formId,
        userEmail,
        error,
      });
    }
  }

  if (data.formId === FORM_ID_CASH_FLOW) {
    await handleCashFlow(userEmail, payload);
    await handleFinancialMetrics(userEmail, payload);
    await handleFinancialPeriod(userEmail, payload);

    const theMonthRpp = payload?.FinancialTargetsReport?.B10 ?? null;
    if (theMonthRpp !== null) {
      await prisma.productivityRecord.upsert({
        where: { userEmail },
        update: { theMonthRpp, recordedAt: new Date() },
        create: { userEmail, percentage: 0, theMonthRpp, recordedAt: new Date() },
      });
      await recalculateProductivityPercentage(userEmail);
    }
  }

  if (data.formId === FORM_ID_FINANCIAL) {
    const pl = payload?.ProfitAndLossReport;
    await upsertFinancialMetric(userEmail, "REVENUE", "YEAR", pl?.I9 ?? null, null);
    await handleFinancialBudgets(userEmail, payload);

    const breakEvenRpp = payload?.FinancialReport?.B14 ?? null;
    if (breakEvenRpp !== null) {
      await prisma.productivityRecord.upsert({
        where: { userEmail },
        update: { breakEvenRpp, recordedAt: new Date() },
        create: { userEmail, percentage: 0, breakEvenRpp, recordedAt: new Date() },
      });
    }
    // breakEvenRpp doesn't affect percentage calculation — no recalculation needed
  }

  // Only the Final Step form includes the company logo upload field.
  // For all other forms we skip the logo handling entirely.
  if (data.formId === FORM_ID_FINAL) {
    const logo = getCompanyLogo(payload);

    if (logo?.fileUrl?.startsWith("http")) {
      try {
        const companyLogoUrl = await uploadLogoToBlob({
          userEmail,
          companyName: companyName ?? "company",
          fileUrl: logo.fileUrl,
          filename: logo.filename,
          contentType: logo.contentType,
        });

        await prisma.user.update({
          where: { email: userEmail },
          data: { companyLogoUrl },
        });
      } catch (error) {
        console.warn("Company logo upload failed; user row kept.", {
          formId: data.formId,
          userEmail,
          error,
        });
      }
    }
  }
}
