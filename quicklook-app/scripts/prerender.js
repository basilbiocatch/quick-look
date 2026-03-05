/**
 * Post-build prerender script: serves dist, captures MarketingHomePage HTML with Puppeteer,
 * injects SEO meta tags and JSON-LD, writes optimized index.html.
 * Run after: vite build
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const BASE_URL = "https://quicklook.io";

function findCssFile() {
  const assetsDir = path.join(DIST, "assets");
  if (!fs.existsSync(assetsDir)) return null;
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find((f) => f.endsWith(".css"));
  return cssFile ? `/assets/${cssFile}` : null;
}

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function serveDist(port) {
  return http.createServer((req, res) => {
    let p = req.url === "/" || req.url === "" ? "/index.html" : req.url;
    p = path.join(DIST, path.normalize(p).replace(/^(\.\.(\/|\\))+/, ""));
    if (!p.startsWith(DIST)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = path.extname(p);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.end(data);
    });
  });
}

function getSEOHead(cssPath) {
  const title = "Quicklook – Session Replay & DevTools for Developers | Debug Faster";
  const description =
    "Session replay and DevTools built for developers. Record user sessions, debug with integrated DevTools, and ship faster. Free tier with 1,000 sessions.";
  const ogImage = `${BASE_URL}/og-image.png`;
  const cssLink = cssPath ? `\n    <link rel="stylesheet" href="${cssPath}" />` : "";

  return `  <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="index, follow" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="session replay, session replay tool, devtools, debugging tools, frontend monitoring, user session recording, developer tools" />
    <link rel="canonical" href="${BASE_URL}/" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />${cssLink}
    <meta name="theme-color" content="#be95fa" />
    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${BASE_URL}/" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Quicklook - Session replay and DevTools for developers" />
    <meta property="og:site_name" content="Quicklook" />
    <meta property="og:locale" content="en_US" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />`;
}

function getStructuredData() {
  const description =
    "Session replay and DevTools built for developers. Record user sessions, debug with integrated DevTools, and ship faster. Free tier with 1,000 sessions.";

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Quicklook",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web Browser",
    url: BASE_URL,
    description,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      priceCurrency: "USD",
      offerCount: "3",
    },
    screenshot: `${BASE_URL}/logo.png`,
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Quicklook",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: BASE_URL,
    name: "Quicklook",
    description,
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL + "/" },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is session replay?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Session replay is a developer tool that records how users interact with your web app—clicks, scrolls, navigation, and inputs—so you can replay the session exactly as it happened. It helps you reproduce bugs and understand user behavior.",
        },
      },
      {
        "@type": "Question",
        name: "How does Quicklook help developers debug?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Quicklook combines session replay with integrated DevTools: you see the user's recording alongside console logs, network requests, and user context in one place. No more guessing what the user did—replay the session and debug with full context.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free tier?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Quicklook offers a free tier with 1,000 sessions per month and 30-day retention. You get session recording to get started; Pro adds DevTools, 90-day retention, multiple projects, AI Insights (conversion impact, friction patterns), session summaries, and suggested fixes with predicted lift for A/B tests.",
        },
      },
      {
        "@type": "Question",
        name: "How do I add session replay to my app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Add the Quicklook script to your site, create a project in the dashboard, and start recording. The SDK captures DOM events and sends them to Quicklook so you can replay sessions in the dashboard.",
        },
      },
      {
        "@type": "Question",
        name: "What is included in Quicklook DevTools?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DevTools in Quicklook include console logs, network requests, and user context (device, URL, etc.) synchronized with the session replay. Everything appears in one view so you can debug faster.",
        },
      },
    ],
  };

  return [
    { type: "application/ld+json", json: softwareApplication },
    { type: "application/ld+json", json: organization },
    { type: "application/ld+json", json: website },
    { type: "application/ld+json", json: breadcrumb },
    { type: "application/ld+json", json: faqPage },
  ];
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectSEO(html, cssPath) {
  const headContent = getSEOHead(cssPath);
  const structuredData = getStructuredData();
  const scriptTags = structuredData
    .map(
      (s) =>
        `  <script type="${escapeHtml(s.type)}">${JSON.stringify(s.json)}</script>`
    )
    .join("\n");

  // Inline style hides body until JS adds "ready" class (prevents FOUC from Emotion/MUI
  // styles injecting after first paint). The body must NOT start with class="ready" for
  // this to work — we strip it below.
  const foucGuard = `  <style>body:not(.ready){visibility:hidden}</style>`;

  const newHead = `<head>\n${headContent}\n${scriptTags}\n${foucGuard}\n  </head>`;
  let replaced = html.replace(/<head>[\s\S]*?<\/head>/i, newHead);

  // Strip the "ready" class Puppeteer captured — it must be absent on initial load
  // so the FOUC guard above hides the body until main.jsx adds it after styles inject.
  replaced = replaced.replace(/<body\s+class="ready"/i, "<body");

  return replaced;
}

function extractBodyScripts(html) {
  const matches = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  return matches.filter((tag) => /src\s*=/.test(tag) && !/application\/ld\+json/.test(tag));
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ not found. Run 'vite build' first.");
    process.exit(1);
  }

  const indexPath = path.join(DIST, "index.html");
  const originalIndex = fs.readFileSync(indexPath, "utf8");
  const bodyScripts = extractBodyScripts(originalIndex);

  const puppeteer = await import("puppeteer").catch(() => null);
  if (!puppeteer) {
    console.error("puppeteer not found. Install with: npm i -D puppeteer");
    process.exit(1);
  }

  const server = serveDist(0);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  try {
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector("main", { timeout: 10000 });
    const html = await page.content();
    await browser.close();

    const cssPath = findCssFile();
    let optimized = injectSEO(html, cssPath);
    if (bodyScripts.length && !/<script[^>]*src\s*=/.test(optimized)) {
      const scriptsHtml = bodyScripts.join("\n    ");
      optimized = optimized.replace("</body>", `\n    ${scriptsHtml}\n  </body>`);
    }
    fs.writeFileSync(indexPath, optimized, "utf8");

    const lastmod = new Date().toISOString().slice(0, 10);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${BASE_URL}/signup</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
    fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap, "utf8");

    console.log("Prerender complete: dist/index.html and dist/sitemap.xml updated.");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
