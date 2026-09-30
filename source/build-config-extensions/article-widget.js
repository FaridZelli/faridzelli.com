// ----------------------------------------
// https://github.com/FaridZelli
// ----------------------------------------

// article-widget.js
const fs = require('fs');

// Define the absolute or relative path to your generated index file here
const INDEX_FILE_PATH = 'source/index.json';

module.exports = {
	'article-list': () => renderList(false),
	'article-list-recent': () => renderList(true),
	'article-date': (ctx) => renderDate(ctx)
};

// ------------------------------
// Data Loading
// ------------------------------

function loadArticles() {
	if (!fs.existsSync(INDEX_FILE_PATH)) {
		console.warn(`⚠️ Index file not found at ${INDEX_FILE_PATH}`);
		return [];
	}
	try {
		return JSON.parse(fs.readFileSync(INDEX_FILE_PATH, 'utf8'));
	} catch (e) {
		console.warn('❌ Failed to parse JSON index.');
		return [];
	}
}

// ------------------------------
// List Rendering
// ------------------------------

function renderList(isRecent) {
	const articles = loadArticles();
	if (!articles || articles.length === 0) return '';

	const sorted = articles
	.map(a => ({ ...a, pubDate: parseDate(a.dateString) }))
	.filter(a => a.pubDate)
	.sort((a, b) => b.pubDate - a.pubDate);

	const list = isRecent ? sorted.slice(0, 5) : sorted;
	if (list.length === 0) return '';

	let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
	for (const article of list) {
		html += '<li style="margin-bottom: 1.2rem;">';
		html += `<a href="${article.fileName}" style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(article.title)}</a>`;

		if (article.pubDate) {
			html += `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem; margin-top: 0.2rem;">${formatArticleDate(article.pubDate)}</div>`;
		}

		if (article.description) {
			html += `<div style="margin-top: 0.2rem;">${escapeHtml(article.description)}</div>`;
		}
		html += '</li>';
	}
	html += '</ul>';
	return html;
}

// ------------------------------
// Date Rendering (From Current Page Context)
// ------------------------------

function renderDate(ctx) {
	const { attributes } = ctx;

	const pubDate = parseDate(attributes.datePublished);
	const modDate = parseDate(attributes.dateModified);

	if (!pubDate) return '';

	let html = '<div style="padding: 0; margin: 0; list-style: none;">';
	html += `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem;">Published: ${formatArticleDate(pubDate)}</div>`;

	if (modDate && pubDate.toDateString() !== modDate.toDateString()) {
		html += `<div style="color: var(--article-date-color); font-family: monospace; font-size: 0.9rem; margin-top: 0.2rem;">Last modified: ${formatArticleDate(modDate)}</div>`;
	}

	html += '</div>';
	return html;
}

// ------------------------------
// Utilities
// ------------------------------

function parseDate(dateInput) {
	if (!dateInput) return null;

	if (dateInput instanceof Date) {
		return isNaN(dateInput) ? null : dateInput;
	}

	const dateString = String(dateInput);
	const d = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
	return isNaN(d) ? null : d;
}

function formatArticleDate(date) {
	const day = date.getUTCDate();
	const suffix =
	day % 10 === 1 && day !== 11 ? 'st' :
	day % 10 === 2 && day !== 12 ? 'nd' :
	day % 10 === 3 && day !== 13 ? 'rd' : 'th';

	const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
	const [month, year] = monthYear.split(' ');
	return `${month} ${day}${suffix}, ${year}`;
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#039;');
}
