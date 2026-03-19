// Named constants for Cognito form IDs that trigger special server-side logic.
// Keeping them here means a form ID change only needs to be updated in one place.

/** Objectives form — triggers 90-day action sync and productivity target upsert. */
export const FORM_ID_OBJECTIVES = "8";

/** Final Step / Reflections & Summary — triggers company logo upload. */
export const FORM_ID_FINAL = "29";

/** Financial Forecast — triggers P&L metric upsert and financial budgets sync. */
export const FORM_ID_FINANCIAL = "25";

/** Cash Flow & Financial Metrics form — triggers cash-flow and metrics upsert. */
export const FORM_ID_CASH_FLOW = "41";
