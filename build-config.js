// All paths in this file are resolved relative to workingDir and are strictly
// sandboxed inside the project directory for security.

module.exports = {
  // The root directory used as the base for resolving all other relative paths.
  workingDir: '.',

  // The directory served by the built-in local web server and used to compute page URLs.
  webDir: 'public',

  // The placeholder token in HTML templates where rendered Markdown content is injected.
  contentPlaceholder: 'ARTICLE_CONTENT',

  // Local development server settings used when running in live mode (--live).
  server: {
    host: '127.0.0.1',
    port: 8000
  },

  // Global fallback values exposed as {{UPPER_SNAKE_CASE}} placeholders in every template.
  // Any page can override these values by defining the same key in its front matter.
  defaults: {
    baseUrl: 'https://faridzelli.com'
  },

  // Maps a missing front-matter field to another field on the same page.
  // For example, if a page omits "hero", it automatically falls back to "title".
  fieldFallbacks: {
    hero: 'title'
  },

  // Extensions loaded once per build. Each extension can hook into collected site data
  // and register widgets matched by HTML element IDs (such as <ul id="article-list"></ul>).
  extensions: [
    'source/extensions/article-widget/article-widget.js',
    'source/extensions/sitemap/sitemap.js'
  ],

  // Content sections to build. Each section pairs a Markdown source directory with an HTML template.
  sections: [
    {
      name: 'about',
      srcDir: 'source/markdown/about',
      outDir: 'public/about',
      template: 'source/templates/template-article.html',
      requiredFields: ['title', 'description'],
      cleanOrphans: true
    },
    {
      name: 'writings',
      srcDir: 'source/markdown/writings',
      outDir: 'public/writings',
      template: 'source/templates/template-article.html',
      requiredFields: ['title', 'description', 'datePublished', 'dateModified'],
      indexRequiredFields: ['title', 'description'],
      cleanOrphans: true
    },
    {
      name: 'home',
      srcDir: 'source/markdown/home',
      outDir: 'public',
      template: 'source/templates/template-home.html',
      requiredFields: [],
      cleanOrphans: true
    }
  ]
};
