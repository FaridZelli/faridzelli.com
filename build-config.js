// ----------------------------------------
// https://github.com/FaridZelli
// ----------------------------------------

// Website Build Configuration
//
// Define your content directories and build settings below.
// The path for the local web server is defined by the 'webDir'.
// Config paths are relative to the 'workingDir'.

// @typedef {Object} BuildConfig
// @property {string} name - Output section name (e.g., 'articles')
// @property {string} srcDir - Source markdown directory
// @property {string} outDir - Output HTML directory
// @property {string} template - Template file path
// @property {string[]} requiredFields - Front-matter fields to validate
// @property {string[]} extensions - Static JS extensions (e.g., 'widget.js')
// @property {boolean} generateIndexFile - Whether to export filename list
// @property {string} [indexOutputPath] - JS index output path (required if generateIndexFile=true)
// @property {string} [indexVariableName] - JS variable name (required if generateIndexFile=true)

module.exports = {
    webDir: 'public',
	workingDir: '.',
	configs: [
		{
			name: 'about',
			srcDir: 'source/md-about',
			outDir: 'public/about',
			template: 'source/build-config-templates/template-article.html.txt',
			requiredFields: ['title', 'description'],
			generateIndexFile: false
		},
		{
			name: 'articles',
			srcDir: 'source/md-articles',
			outDir: 'public/articles',
			template: 'source/build-config-templates/template-article.html.txt',
			requiredFields: ['title', 'description', 'datePublished', 'dateModified'],
			extensions: ['source/build-config-extensions/article-widget.js'],
			generateIndexFile: true,
			indexOutputPath: 'source/index.json',
			indexVariableName: 'ARTICLE_METADATA'
		},
		{
			name: 'home',
			srcDir: 'source/md-home',
			outDir: 'public',
			template: 'source/build-config-templates/template-home.html.txt',
			requiredFields: [],
			extensions: ['source/build-config-extensions/article-widget.js'],
			generateIndexFile: false
		}
	]
};
