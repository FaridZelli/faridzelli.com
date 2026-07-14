/**
 * Website Build Configuration
 *
 * Define your content directories and build settings below.
 * All paths are relative to the 'workingDir'.
 */

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

module.exports = {
	/**
	 * The root folder for your website content.
	 * Must be a subfolder relative to where this script is located.
	 */
	workingDir: 'public',

	/** @type {BuildConfig[]} */
	configs: [
		{
			name: 'articles',
			srcDir: 'articles-markdown',
			outDir: 'articles',
			template: 'assets/template-article.html.txt',
			requiredFields: ['title', 'description', 'datePublished', 'dateModified'],
			generateIndexFile: true,
			indexOutputPath: 'articles/index-list.js',
			indexVariableName: 'ARTICLE_FILE_NAMES'
		},
		{
			name: 'about',
			srcDir: 'about-markdown',
			outDir: 'about',
			template: 'assets/template-article.html.txt',
			requiredFields: ['title', 'description'],
			generateIndexFile: false
		}
	]
};
