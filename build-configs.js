// build-configs.js
const path = require('path');

/**
 * @typedef {Object} BuildConfig
 * @property {string} name - Output section name (e.g., 'articles')
 * @property {string} srcDir - Source markdown directory
 * @property {string} outDir - Output HTML directory
 * @property {string} template - Template file path
 * @property {string[]} requiredFields - Front-matter fields to validate
 * @property {boolean} generateIndexFile - Whether to export filename list
 * @property {string} [indexOutputPath] - JS index output path (required if generateIndexFile=true)
 * @property {string} [indexVariableName] - JS variable name (required if generateIndexFile=true)
 */

/** @type {BuildConfig[]} */
module.exports = [
  {
    name: 'articles',
    srcDir: path.join(__dirname, 'articles-markdown'),
    outDir: path.join(__dirname, 'articles'),
    template: path.join(__dirname, 'build-template/build-template-article.html.txt'),
    requiredFields: ['title', 'description', 'datePublished', 'dateModified'],

    generateIndexFile: true,
    indexOutputPath: path.join(__dirname, 'article-list-index.js'),
    indexVariableName: 'ARTICLE_FILE_NAMES'
  },
  {
    name: 'about',
    srcDir: path.join(__dirname, 'about-markdown'),
    outDir: path.join(__dirname, 'about'),
    template: path.join(__dirname, 'build-template/build-template-article.html.txt'),
    requiredFields: ['title', 'description'],

    generateIndexFile: false
  }
];

