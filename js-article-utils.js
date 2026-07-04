// ----------------------------------------
// https://github.com/FaridZelli
// ----------------------------------------

import { ARTICLE_FILE_NAMES } from './article-list-index.js';

// Base styling for date text elements (reused across components)
const BASE_DATE_STYLE = {
	color: '#888',
	fontFamily: 'monospace',
	fontSize: '0.9rem'
};

// Format Date object to "Month DaySuffix, Year" (e.g., "February 1st, 2026")
function formatArticleDate(date) {
	const day = date.getDate();
	const suffix =
	day % 10 === 1 && day !== 11 ? 'st' :
	day % 10 === 2 && day !== 12 ? 'nd' :
	day % 10 === 3 && day !== 13 ? 'rd' : 'th';
	const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	const [month, year] = monthYear.split(' ');
	return `${month} ${day}${suffix}, ${year}`;
}

initializeArticleIndex();

async function initializeArticleIndex() {
	const articleMetadataList = await loadAllArticleMetadata();
	const sortedArticles = sortArticlesByDateDescending(articleMetadataList);

	renderArticlesToContainer(sortedArticles, 'article-list');
	renderArticlesToContainer(sortedArticles.slice(0, 5), 'article-list-recent');
	renderArticleDate('article-date'); // New component renderer
}

// ------------------------------
// Fetch and parse metadata for all articles
// ------------------------------

async function loadAllArticleMetadata() {
	const metadataList = [];

	for (const fileName of ARTICLE_FILE_NAMES) {
		try {
			const metadata = await fetchArticleMetadata(fileName);
			metadataList.push(metadata);
		} catch (error) {
			console.error(`Failed to load article metadata: ${fileName}`, error);
		}
	}

	return metadataList;
}

// ------------------------------
// Fetch a single article and extract metadata from its HTML
// ------------------------------

async function fetchArticleMetadata(fileName) {
	const response = await fetch(fileName);
	const htmlText = await response.text();

	const documentObject = new DOMParser().parseFromString(
		htmlText,
		"text/html"
	);

	const title =
	documentObject.querySelector("title")?.textContent?.trim()
	?? fileName;

	const description =
	documentObject
	.querySelector('meta[name="description"]')
	?.getAttribute("content")
	?? "";

	const dateString =
	documentObject
	.querySelector('meta[property="article:published_time"]')
	?.getAttribute("content")
	?? null;

	const publicationDate = dateString
	? new Date(dateString)
	: new Date(0); // fallback for undated articles

	return {
		fileName,
		title,
		description,
		publicationDate,
		dateString
	};
}

// ------------------------------
// Sort articles by date, newest first
// ------------------------------

function sortArticlesByDateDescending(articles) {
	return articles.sort(
		(a, b) => b.publicationDate - a.publicationDate
	);
}

// ------------------------------
// Unified renderer: handles any article list container
// ------------------------------

function renderArticlesToContainer(articles, containerId) {
	const container = document.getElementById(containerId);
	if (!container) return;

	Object.assign(container.style, {
		listStyle: 'none',
		padding: '0',
		margin: '0'
	});
	container.innerHTML = '';

	for (const article of articles) {
		const listItem = document.createElement('li');
		listItem.style.marginBottom = '1.2rem';

		const titleLink = document.createElement('a');
		titleLink.href = article.fileName;
		titleLink.textContent = article.title;
		Object.assign(titleLink.style, {
			fontWeight: 'bold',
			fontSize: '1.1rem'
		});
		listItem.appendChild(titleLink);

		if (article.dateString) {
			const dateLine = document.createElement('div');
			dateLine.textContent = formatArticleDate(article.publicationDate);
			// Reuse base style + contextual margin
			Object.assign(dateLine.style, BASE_DATE_STYLE, { marginTop: '0.2rem' });
			listItem.appendChild(dateLine);
		}

		if (article.description) {
			const desc = document.createElement('div');
			desc.textContent = article.description;
			desc.style.marginTop = '0.2rem';
			listItem.appendChild(desc);
		}

		container.appendChild(listItem);
	}
}

// ------------------------------
// Render current page's publication/modification dates
// ------------------------------

function renderArticleDate(containerId) {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Reset container styling to remove default spacing (consistent with article-list containers)
	Object.assign(container.style, {
		padding: '0',
		margin: '0',
		listStyle: 'none' // Safe for divs; critical if container is a list element
	});
	container.innerHTML = ''; // Clear prior content to prevent duplication

	// Extract dates from CURRENT document's meta tags (no fetch needed)
	const pubMeta = document.querySelector('meta[property="article:published_time"]');
	if (!pubMeta?.content) return;

	try {
		const pubDate = new Date(pubMeta.content);
		if (isNaN(pubDate)) throw new Error('Invalid published date');

		// Format published line
		const pubLine = `Published: ${formatArticleDate(pubDate)}`;
		const pubDiv = document.createElement('div');
		pubDiv.textContent = pubLine;
		Object.assign(pubDiv.style, BASE_DATE_STYLE); // No top margin for first line
		container.appendChild(pubDiv);

		// Check modified date (only show if different calendar day)
		const modMeta = document.querySelector('meta[property="article:modified_time"]');
		if (modMeta?.content) {
			const modDate = new Date(modMeta.content);
			if (!isNaN(modDate)) {
				// Compare date components only (ignore time)
				const pubKey = pubDate.toDateString();
				const modKey = modDate.toDateString();

				if (pubKey !== modKey) {
					const modLine = `Last modified: ${formatArticleDate(modDate)}`;
					const modDiv = document.createElement('div');
					modDiv.textContent = modLine;
					// Reuse base style + consistent spacing between lines
					Object.assign(modDiv.style, BASE_DATE_STYLE, { marginTop: '0.2rem' });
					container.appendChild(modDiv);
				}
			}
		}
	} catch (e) {
		console.error('Error rendering article-date:', e);
		container.innerHTML = ''; // Ensure clean state on failure
	}
}
