import { z } from "zod";

export const businessPlanSchema = z.object({});

export type BusinessPlanInput = z.infer<typeof businessPlanSchema>;
