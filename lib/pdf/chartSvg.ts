// lib/pdf/chartSvg.ts
//
// Renders a simple multi-series line chart as an inline SVG string, suitable
// for embedding directly into a Handlebars template that Puppeteer then
// rasterises into a PDF. No external runtime dependencies — we need sharp,
// deterministic visuals in the headless browser without Recharts (which
// pulls a React DOM and animations we don't want in a print document).

type Point = { label: string; value: number };

type Series = {
  name: string;
  color: string;
  dashed?: boolean;
  points: Point[];
};

type ChartOptions = {
  series: Series[];
  width?: number;
  height?: number;
};

export function renderLineChartSvg({ series, width = 720, height = 280 }: ChartOptions): string {
  const padding = { top: 28, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xLabels = series[0]?.points.map((p) => p.label) ?? [];
  const n = xLabels.length;

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const maxRaw = Math.max(0, ...allValues);
  const max = niceMax(maxRaw);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  const xAt = (i: number) =>
    padding.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yAt = (v: number) =>
    padding.top + chartH - (max > 0 ? (v / max) * chartH : 0);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" style="font-family: Figtree, Arial, sans-serif;">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  // Y gridlines and labels
  for (const v of yTicks) {
    const y = yAt(v);
    parts.push(
      `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${formatTick(v)}</text>`,
    );
  }

  // X-axis labels
  for (let i = 0; i < n; i++) {
    parts.push(
      `<text x="${xAt(i)}" y="${height - padding.bottom + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${escapeXml(xLabels[i] ?? "")}</text>`,
    );
  }

  // Series paths + points
  for (const s of series) {
    if (s.points.length === 0) continue;
    const d = s.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
      .join(" ");
    const dashAttr = s.dashed ? ' stroke-dasharray="6 4"' : "";
    parts.push(
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"${dashAttr}/>`,
    );
    for (let i = 0; i < s.points.length; i++) {
      parts.push(
        `<circle cx="${xAt(i).toFixed(2)}" cy="${yAt(s.points[i].value).toFixed(2)}" r="3" fill="${s.color}"/>`,
      );
    }
  }

  // Legend row (top-left)
  let legendX = padding.left;
  const legendY = 14;
  for (const s of series) {
    parts.push(
      `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 20}" y2="${legendY}" stroke="${s.color}" stroke-width="2"${s.dashed ? ' stroke-dasharray="4 3"' : ""}/>`,
    );
    parts.push(
      `<text x="${legendX + 25}" y="${legendY + 4}" font-size="11" fill="#111">${escapeXml(s.name)}</text>`,
    );
    legendX += 25 + estimateTextWidth(s.name) + 18;
  }

  parts.push(`</svg>`);
  return parts.join("");
}

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const ratio = v / pow;
  let nice: number;
  if (ratio <= 1) nice = 1;
  else if (ratio <= 2) nice = 2;
  else if (ratio <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

function formatTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

function estimateTextWidth(s: string): number {
  return s.length * 6.2;
}

function escapeXml(v: string): string {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
