// lib/pdf/renderTemplate.ts
//
// Compiles the Handlebars business plan template into a self-contained HTML string
// that Puppeteer can render as a PDF. All external assets (CSS, images) are inlined
// as base64 data URIs so Puppeteer does not need to make any network requests.

import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";

// Maps a file extension to its MIME type for building data URIs.
function extToMime(ext: string) {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

// Reads a local file from disk and returns it as a base64 data URI.
// Used to inline the risk chart image so Puppeteer can render it without
// needing filesystem access from inside the headless browser.
async function fileToDataUri(relativePathFromRoot: string) {
  const abs = path.join(process.cwd(), relativePathFromRoot);
  const buf = await fs.readFile(abs);
  const mime = extToMime(path.extname(abs));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Safely parses any value into a Date, returning null if the value is
// missing, not a string, or does not represent a valid date.
function parseToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Core date formatter used by the {{formatDate}} Handlebars helper.
// Supports two named formats: "MMMM yyyy" and "dd/MM/yyyy".
// Falls back to "dd Month yyyy" (e.g. "06 March 2026") if no format is specified.
function formatDateImpl(value: unknown, format?: string) {
  const d = parseToDate(value);
  if (!d) return "";

  const fmt = String(format ?? "").trim();

  if (fmt === "MMMM yyyy") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(d);
  }

  if (fmt === "dd/MM/yyyy") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

// {{formatDate value "MMMM yyyy"}} — formats a date string in the template.
Handlebars.registerHelper("formatDate", formatDateImpl);

// Converts a number-like value (string with commas, or plain number) to a JS number.
// Returns null for anything that isn't a finite number.
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// {{formatCurrency value "GBP"}} — formats a number as a currency string.
// Defaults to GBP if no currency code is provided.
// Example: 1500 → "£1,500.00"
Handlebars.registerHelper(
  "formatCurrency",
  (value: unknown, currency?: string) => {
    const n = toNumber(value);
    if (n === null) return "";

    const code = typeof currency === "string" && currency ? currency : "GBP";

    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  },
);

// {{formatPercentage value decimals}} — multiplies a decimal by 100 and appends "%".
// Example: 0.25 with 1 decimal → "25.0%"
// The `decimals` argument is optional and defaults to 0.
Handlebars.registerHelper(
  "formatPercentage",
  (value: unknown, decimals?: unknown) => {
    const n = toNumber(value);
    if (n === null) return "";

    const d =
      typeof decimals === "number"
        ? decimals
        : typeof decimals === "string" && decimals.trim() !== ""
          ? Number(decimals)
          : 0;

    const safeDecimals = Number.isFinite(d) ? Math.max(0, Math.min(6, d)) : 0;
    const pct = n * 100;
    return `${pct.toFixed(safeDecimals)}%`;
  },
);

// {{formatBritishDate value}} — formats a date as "DD-MM-YYYY".
// Example: 2026-03-06 → "06-03-2026"
Handlebars.registerHelper("formatBritishDate", (value: unknown) => {
  const d = parseToDate(value);
  if (!d) return "";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
});

// {{riskBG value}} — maps a risk level code (L / M / H) to a CSS class name
// used to colour the risk table rows in the PDF template.
Handlebars.registerHelper("riskBG", (value: unknown) => {
  const v = String(value ?? "")
    .trim()
    .toUpperCase();
  if (v === "L") return "low";
  if (v === "M") return "medium";
  if (v === "H") return "high";
  return "";
});

// Renders the business-plan.hbs Handlebars template into a complete HTML string.
// Steps:
//   1. Convert the local risk chart PNG to a base64 data URI (so it renders in Puppeteer).
//   2. Read the template source and CSS from disk in parallel.
//   3. Compile and execute the template with the DTO data + inlined assets.
export async function renderBusinessPlanTemplate(dto: any) {
  const templatePath = path.join(
    process.cwd(),
    "lib",
    "templates",
    "business-plan.hbs",
  );
  const cssPath = path.join(
    process.cwd(),
    "lib",
    "templates",
    "business-plan.css",
  );

  // Inline the risk chart so Puppeteer doesn't need filesystem/network access for it.
  const riskChartDataUri = await fileToDataUri("public/risk-chart.png");

  const [templateSource, css] = await Promise.all([
    fs.readFile(templatePath, "utf8"),
    fs.readFile(cssPath, "utf8"),
  ]);

  // strict: true causes Handlebars to throw if any template variable is undefined,
  // which helps catch missing data early rather than producing a silently broken PDF.
  const template = Handlebars.compile(templateSource, { strict: true });

  return template({
    ...dto,
    css,            // injected into a <style> tag inside the template
    riskChartDataUri,
  });
}
