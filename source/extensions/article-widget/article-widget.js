'use strict';

const path = require('path');

// The section name from build-config.js containing the articles to index and display.
const ARTICLES_SECTION = 'writings';

// The output location for the article index, resolved relative to this extension file.
const INDEX_OUTPUT_PATH = path.join(__dirname, 'out/list.json');

// The output location for the article index, resolved relative to the project's workingDir.
// const INDEX_OUTPUT_PATH = 'source/extensions/article-widget/out/list.json';

// The maximum number of articles displayed by the "article-list-recent" widget.
const RECENT_ARTICLE_LIMIT = 5;

// Holds the sorted article list computed during onBuild() so widgets do not re-read disk per page.
let sortedArticles = [];

// Parses an ISO date string (such as "2026-02-20") into a UTC Date object without local timezone drift.
function parseIsoDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  const text = String(dateInput).trim();
  const isoString = text.includes('T') ? text : `${text}T00:00:00Z`;
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Formats a UTC Date object as a human-readable string such as "February 20th, 2026".
function formatDisplayDate(date) {
  const day = date.getUTCDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th';

  const month = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = date.getUTCFullYear();

  return `${month} ${day}${suffix}, ${year}`;
}

// Renders either the complete article list or a truncated list of recent articles.
function renderArticleList(site, limit) {
  const items = limit ? sortedArticles.slice(0, limit) : sortedArticles;
  if (items.length === 0) {
    return '';
  }

  const { escapeHtml } = site.utils;
  const listItems = items.map((article) => {
    const pubDate = parseIsoDate(article.datePublished);
    const dateHtml = pubDate
      ? `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem; margin-top: 0.2rem;">${formatDisplayDate(pubDate)}</div>`
      : '';
    const descHtml = article.description
      ? `<div style="margin-top: 0.2rem;">${escapeHtml(article.description)}</div>`
      : '';

    return [
      '<li style="margin-bottom: 1.2rem;">',
      `<a href="${escapeHtml(article.url)}" style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(article.title)}</a>`,
      dateHtml,
      descHtml,
      '</li>'
    ].join('');
  });

  return `<ul style="list-style: none; padding: 0; margin: 0;">${listItems.join('')}</ul>`;
}

// Renders the published and last-modified timestamps for the currently rendered article page.
function renderArticleDate(page) {
  const pubDate = parseIsoDate(page.attributes.datePublished);
  if (!pubDate) {
    return '';
  }

  const modDate = parseIsoDate(page.attributes.dateModified);
  const lines = [
    `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem;">Published: ${formatDisplayDate(pubDate)}</div>`
  ];

  if (modDate && pubDate.toISOString().slice(0, 10) !== modDate.toISOString().slice(0, 10)) {
    lines.push(
      `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem; margin-top: 0.2rem;">Last modified: ${formatDisplayDate(modDate)}</div>`
    );
  }

  return `<div style="padding: 0; margin: 0; list-style: none;">${lines.join('')}</div>`;
}

module.exports = {
  name: 'article-widget',

  // Runs once after all Markdown files are collected, builds and writes the sorted index.
  onBuild(site) {
    const articles = site
      .getPages(ARTICLES_SECTION)
      .filter((page) => !page.isIndex);

    sortedArticles = articles
      .map((page) => ({
        url: page.url,
        title: String(page.attributes.title || '').trim(),
        description: String(page.attributes.description || '').trim(),
        datePublished: String(page.attributes.datePublished || '').trim(),
        dateModified: String(page.attributes.dateModified || '').trim()
      }))
      .sort((a, b) => {
        const timeA = parseIsoDate(a.datePublished)?.getTime() || 0;
        const timeB = parseIsoDate(b.datePublished)?.getTime() || 0;
        return timeB - timeA || a.url.localeCompare(b.url);
      });

    site.writeFile(INDEX_OUTPUT_PATH, `${JSON.stringify(sortedArticles, null, 2)}\n`);
  },

  // Maps HTML element IDs to pure render functions receiving the current page and site API.
  widgets: {
    'article-list': (_page, site) => renderArticleList(site, null),
    'article-list-recent': (_page, site) => renderArticleList(site, RECENT_ARTICLE_LIMIT),
    'article-date': (page) => renderArticleDate(page)
  }
};
