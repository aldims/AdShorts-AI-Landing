const normalizedHeader = (value) => String(value)
  .replace(/^\uFEFF/, "")
  .trim()
  .toLocaleLowerCase("ru-RU")
  .replace(/[._-]+/g, " ")
  .replace(/\s+/g, " ");

const countDelimiter = (line, delimiter) => {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      count += 1;
    }
  }
  return count;
};

export const detectDelimiter = (source) => {
  const firstLine = String(source).split(/\r?\n/).find((line) => line.trim()) ?? "";
  return [",", ";", "\t"]
    .map((delimiter) => ({ delimiter, count: countDelimiter(firstLine, delimiter) }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
};

export const parseCsv = (source, delimiter = detectDelimiter(source)) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = String(source).replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizedHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

const columnAliases = {
  query: ["query", "queries", "top queries", "запрос", "запросы", "поисковый запрос"],
  page: ["page", "pages", "top pages", "url", "urls", "страница", "страницы", "адрес страницы"],
  clicks: ["clicks", "клики", "переходы"],
  impressions: ["impressions", "показы"],
  ctr: ["ctr", "ctr %", "ctr, %", "кликабельность"],
  position: ["position", "average position", "позиция", "средняя позиция"],
};

const resolveColumn = (row, key) => {
  const headers = Object.keys(row);
  const aliases = columnAliases[key].map(normalizedHeader);
  return headers.find((header) => aliases.includes(normalizedHeader(header)));
};

export const parseMetric = (value) => {
  const raw = String(value ?? "")
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(/[^\d.,+%\-]/g, "");
  const isPercent = raw.endsWith("%");
  let source = raw.replace(/%$/, "");
  if (source.includes(",") && source.includes(".")) {
    source = source.lastIndexOf(",") > source.lastIndexOf(".")
      ? source.replaceAll(".", "").replace(",", ".")
      : source.replaceAll(",", "");
  } else if (source.includes(",")) {
    const fractionLength = source.length - source.lastIndexOf(",") - 1;
    source = isPercent || fractionLength <= 2 ? source.replace(",", ".") : source.replaceAll(",", "");
  }
  const number = Number(source);
  return Number.isFinite(number) ? number : 0;
};

const ctrFrom = (clicks, impressions, reportedCtr) => {
  if (impressions > 0) return clicks / impressions * 100;
  return reportedCtr;
};

const isBrandQuery = (query) => /(?:ad\s*shorts?|adshortsai|adshortsai\.com|эд\s*шортс)/i.test(query);

export const analyzeSearchRows = (rows, { source, benchmarkCtr = 0, siteOrigin = "https://adshortsai.com" } = {}) => {
  if (!rows.length) return { source, dimension: "unknown", rows: 0, totals: { clicks: 0, impressions: 0, ctrPercent: 0 } };
  const sample = rows[0];
  const columns = {
    query: resolveColumn(sample, "query"),
    page: resolveColumn(sample, "page"),
    clicks: resolveColumn(sample, "clicks"),
    impressions: resolveColumn(sample, "impressions"),
    ctr: resolveColumn(sample, "ctr"),
    position: resolveColumn(sample, "position"),
  };
  if (!columns.clicks || !columns.impressions) throw new Error(`${source}: CSV must contain clicks and impressions columns.`);
  const dimension = columns.query ? "query" : columns.page ? "page" : "aggregate";
  const normalized = rows.map((row) => {
    const clicks = parseMetric(row[columns.clicks]);
    const impressions = parseMetric(row[columns.impressions]);
    const reportedCtr = parseMetric(row[columns.ctr]);
    const label = String(row[columns.query] ?? row[columns.page] ?? "").trim();
    return {
      label,
      clicks,
      impressions,
      ctrPercent: ctrFrom(clicks, impressions, reportedCtr),
      position: parseMetric(row[columns.position]),
    };
  });
  const totals = normalized.reduce((sum, row) => ({ clicks: sum.clicks + row.clicks, impressions: sum.impressions + row.impressions }), { clicks: 0, impressions: 0 });
  totals.ctrPercent = ctrFrom(totals.clicks, totals.impressions, 0);

  const result = { source, dimension, rows: normalized.length, totals };
  if (dimension === "query") {
    const aggregate = (brand) => {
      const group = normalized.filter((row) => isBrandQuery(row.label) === brand);
      const clicks = group.reduce((sum, row) => sum + row.clicks, 0);
      const impressions = group.reduce((sum, row) => sum + row.impressions, 0);
      return { clicks, impressions, ctrPercent: ctrFrom(clicks, impressions, 0), queries: group.length };
    };
    result.brand = aggregate(true);
    result.nonBrand = aggregate(false);
  }
  if (dimension === "page") {
    result.growthPages = normalized
      .filter((row) => row.impressions >= 20)
      .map((row) => {
        let pathname = row.label;
        try {
          const parsed = new URL(row.label, siteOrigin);
          pathname = parsed.origin === siteOrigin ? parsed.pathname : parsed.href;
        } catch {}
        return {
          ...row,
          pathname,
          opportunityClicks: Math.max(0, Math.round(row.impressions * (benchmarkCtr - row.ctrPercent) / 100)),
        };
      })
      .sort((a, b) => b.opportunityClicks - a.opportunityClicks || b.impressions - a.impressions)
      .slice(0, 20);
  }
  return result;
};

export const analyzeEventLines = (source) => {
  const byPage = new Map();
  let invalidLines = 0;
  for (const line of String(source).split(/\r?\n/).filter((value) => value.trim())) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      invalidLines += 1;
      continue;
    }
    if (event.event !== "seo_page_view" && event.event !== "seo_cta_click") continue;
    const page = event.canonical || event.path || "unknown";
    const current = byPage.get(page) ?? { pageViews: 0, ctaClicks: 0, studioClicks: 0 };
    if (event.event === "seo_page_view") current.pageViews += 1;
    if (event.event === "seo_cta_click") {
      current.ctaClicks += 1;
      if (event.cta === "studio" || /[?&]source=seo_/i.test(event.href ?? "")) current.studioClicks += 1;
    }
    byPage.set(page, current);
  }
  const pages = [...byPage.entries()].map(([page, values]) => ({
    page,
    ...values,
    studioCtrPercent: values.pageViews ? values.studioClicks / values.pageViews * 100 : 0,
  })).sort((a, b) => b.studioClicks - a.studioClicks || b.pageViews - a.pageViews);
  return {
    invalidLines,
    totals: pages.reduce((sum, row) => ({ pageViews: sum.pageViews + row.pageViews, ctaClicks: sum.ctaClicks + row.ctaClicks, studioClicks: sum.studioClicks + row.studioClicks }), { pageViews: 0, ctaClicks: 0, studioClicks: 0 }),
    pages,
  };
};

const round = (value) => Math.round(value * 100) / 100;
export const roundReport = (value) => {
  if (Array.isArray(value)) return value.map(roundReport);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, roundReport(child)]));
  return typeof value === "number" ? round(value) : value;
};
