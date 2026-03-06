// The canonical list of all Cognito form IDs that must be submitted before a
// business plan PDF can be generated. The order here determines the order they
// appear in the admin dashboard checklist.
//
// Each entry has:
//   formId  — the Cognito Forms numeric ID (stored as a string in the database)
//   key     — the field name used in BusinessPlanTemplateDto
//   title   — the human-readable label shown in the admin UI
export const BUSINESS_PLAN_FORMS = [
  {
    formId: "14",
    key: "offerings",
    title: "Tool to prioritise your offerings",
  },
  {
    formId: "15",
    key: "sectors",
    title: "Tool to Prioritise and Target Clients for maximum ROI",
  },
  { formId: "8", key: "objectives", title: "How to Spotlight Your Objectives" },
  { formId: "11", key: "advantage", title: "How to create an Advantage" },
  {
    formId: "16",
    key: "market",
    title: "Tool to determine your most effective route to market",
  },
  { formId: "12", key: "swot", title: "Business SWOT Analysis Questionnaire" },
  {
    formId: "23",
    key: "ratesCard",
    title: "Questionnaire to Calculate Labour Rates Card",
  },
  {
    formId: "39",
    key: "risks",
    title: "How to identify risks and plan to avoid them",
  },
  {
    formId: "25",
    key: "financial",
    title: "How to Forecast Your Financial Performance",
  },
  { formId: "29", key: "final", title: "Final Step - Reflections and Summary" },
] as const;

export type BusinessPlanFormKey = (typeof BUSINESS_PLAN_FORMS)[number]["key"];
