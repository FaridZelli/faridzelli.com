'use strict';

const path = require('path');

// The filename written to the root of webDir when generating the sitemap.
const SITEMAP_FILENAME = 'sitemap.xml';

// Validates a date value and formats it as a W3C YYYY-MM-DD date string for <lastmod>.
// Returns an empty string when a page has no valid date so the tag can be omitted cleanly.
function formatLastMod(dateInput) {
  if (!dateInput) {
    return '';
  }

  const text = String(dateInput).trim();
  const isoString = text.includes('T') ? text : `${text}T00:00:00Z`;
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

// Builds a single <url> XML entry for a page, including <lastmod> only when date metadata exists.
function renderUrlEntry(page, baseUrl, escapeHtml) {
  const fullUrl = encodeURI(`${baseUrl}${page.url}`);
  const lastMod = formatLastMod(page.attributes.dateModified || page.attributes.datePublished);

  const lines = [
    '  <url>',
    `    <loc>${escapeHtml(fullUrl)}</loc>`
  ];

  if (lastMod) {
    lines.push(`    <lastmod>${lastMod}</lastmod>`);
  }

  lines.push('  </url>');
  return lines.join('\n');
}

module.exports = {
  name: 'sitemap',

  // Runs once per build after all pages are collected and writes sitemap.xml into webDir.
  onBuild(site) {
    const rawBaseUrl = String(site.config.defaults.baseUrl || '').trim();
    if (!rawBaseUrl) {
      throw new Error('Cannot generate sitemap: "defaults.baseUrl" is missing in build-config.js.');
    }

    // Remove any trailing slashes from baseUrl so joining it with page.url never creates double slashes.
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const { escapeHtml } = site.utils;

    // Include every collected page unless it explicitly opts out via "sitemap: false" in front matter.
    const entries = [...site.pages]
      .filter((page) => page.attributes.sitemap !== false)
      .sort((a, b) => a.url.localeCompare(b.url))
      .map((page) => renderUrlEntry(page, baseUrl, escapeHtml));

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
      ''
    ].join('\n');

    const outputPath = path.join(site.config.webDir, SITEMAP_FILENAME);
    site.writeFile(outputPath, xml);
  }
};
