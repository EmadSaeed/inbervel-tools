import { z } from "zod";

// Schema for the /api/pdf development endpoint.
// This endpoint is not used in production — business plan PDFs are generated
// via /api/admin/generate-business-plan and /api/business-dashboard/generate-business-plan.
// TODO: either populate this schema with the full BusinessPlanTemplateDto fields
// or remove this endpoint if it is no longer needed.
export const businessPlanSchema = z.object({});

export type BusinessPlanInput = z.infer<typeof businessPlanSchema>;
