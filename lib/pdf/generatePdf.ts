// lib/pdf/generatePdf.ts
//
// Converts an HTML string into a PDF buffer using a headless Chromium browser.
//
// Two environments are supported:
//   - Vercel (production): uses puppeteer-core with a pre-packaged Chromium binary
//     fetched from a URL (Vercel Blob or GitHub). The binary is specified via the
//     CHROMIUM_BLOB_PACK_URL / CHROMIUM_GITHUB_PACK_URL environment variables.
//   - Local (macOS / Windows): uses the full `puppeteer` package which bundles its
//     own Chromium, so no extra configuration is needed.

import chromium from "@sparticuz/chromium-min";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Detect whether we are running on Vercel by checking the VERCEL env var,
// which Vercel sets automatically on all deployments.
const isVercel = !!process.env.VERCEL;

type PdfOptions = {
  title?: string;
  subtitle?: string;
  footerLeft?: string;
};

// Escapes characters that are special in HTML so they can be safely embedded
// in the header/footer template strings without breaking the HTML structure.
function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Resolves the path to the Chromium executable on Vercel.
// Tries the Blob-hosted pack first (faster, avoids GitHub rate limits),
// then falls back to the GitHub-hosted pack if the primary fails.
async function resolveChromiumExecutablePath(): Promise<string> {
  const primary = process.env.CHROMIUM_BLOB_PACK_URL;
  const secondary = process.env.CHROMIUM_GITHUB_PACK_URL;

  if (primary) {
    try {
      return await chromium.executablePath(primary);
    } catch (err) {
      console.warn("Blob Chromium pack failed; falling back to GitHub.", err);
    }
  }

  if (secondary) return await chromium.executablePath(secondary);

  throw new Error("No Chromium pack URL configured.");
}

// Builds the Puppeteer PDF options object, including the running header (title + company name)
// and the page-numbered footer that appear on every page of the generated PDF.
// Header/footer templates are raw HTML strings injected by Puppeteer — they run in an
// isolated context so external CSS doesn't apply; styles must be inline.
function buildPdfOptions(opts?: PdfOptions) {
  const title = escapeHtml(opts?.title ?? "Business Plan");
  const subtitle = escapeHtml(opts?.subtitle ?? "");
  const footerLeft = escapeHtml(opts?.footerLeft ?? "");

  return {
    printBackground: true,   // render CSS backgrounds and colours
    preferCSSPageSize: true,  // let the template control page size via @page CSS
    displayHeaderFooter: true,

    // Margins must be large enough to make room for the header and footer bands.
    margin: {
      top: "25mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },

    // Header: "Business Plan" on the left, company name on the right.
    headerTemplate: `
      <div style="
        width: 100%;
        font-family: Figtree, Open Sans, Arial, Helvetica, sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 0mm 15mm;
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="opacity: 0.4;">${title}</div>
        <div style="opacity: 0.4;">${subtitle}</div>
      </div>
    `,

    // Footer: optional left slot (e.g. "© Inbervel") + "Page X of Y" on the right.
    // <span class="pageNumber"> and <span class="totalPages"> are special Puppeteer
    // placeholders that are replaced with the actual values at render time.
    footerTemplate: `
      <div style="
        width: 100%;
        font-family: Figtree, Open Sans, Arial, Helvetica, sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 0mm 15mm;
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="opacity: 0.4;">${footerLeft}</div>
        <div style="opacity: 0.4;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    `,
  } as const;
}

/**
 * Converts an HTML string into a PDF buffer.
 *
 * On Vercel the function dynamically imports puppeteer-core and downloads the
 * Chromium binary from a remote pack URL. Locally it uses the full puppeteer
 * package which ships with its own bundled Chromium.
 *
 * The browser is always closed in the `finally` block so resources are freed
 * even if PDF generation throws an error.
 */
export async function htmlToPdfBuffer(
  html: string,
  opts?: PdfOptions,
): Promise<Buffer> {
  const pdfOptions = buildPdfOptions(opts);

  if (isVercel) {
    const puppeteer = await import("puppeteer-core");
    const executablePath = await resolveChromiumExecutablePath();

    const browser = await puppeteer.launch({
      args: chromium.args, // required flags for running Chromium in a serverless environment
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754 }); // A4 at 150 dpi
      // On Vercel, wait for both the load event and no more network activity
      // before printing — images are all data URIs so this resolves quickly.
      await page.setContent(html, { waitUntil: ["load", "networkidle0"] });

      const pdf = await page.pdf(pdfOptions);
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // Local path: use the full puppeteer package with its bundled Chromium binary.
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    page.setDefaultNavigationTimeout(120_000);

    await page.setViewport({ width: 1240, height: 1754 });

    // Use "domcontentloaded" instead of "networkidle0" locally because remote
    // fonts (e.g. Google Fonts) can keep the network busy indefinitely and
    // cause the operation to time out.
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Brief pause to let the browser kick off any asset fetches before we check.
    await sleep(250);

    // Wait for web fonts to finish loading (the FontFaceSet.ready promise).
    // Wrapped in try/catch so a missing fonts API doesn't abort the whole render.
    try {
      await page.evaluate(() => (document as any).fonts?.ready);
    } catch {}

    // Wait for all <img> elements to either load or error before printing,
    // so no images appear blank in the final PDF.
    try {
      await page.evaluate(async () => {
        const imgs = Array.from(document.images || []);
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            });
          }),
        );
      });
    } catch {}

    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
