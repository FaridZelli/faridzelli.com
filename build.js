#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fm = require('front-matter');
const { marked } = require('marked');
const chokidar = require('chokidar');

// ======================
// CONFIGURATION
// ======================
const BUILD_CONFIGS = require('./build-configs.js');
const IS_LIVE_MODE = process.argv.includes('--live');
const HTTP_SERVER_PORT = 8000;
const HTTP_SERVER_HOST = '127.0.0.1';

// ======================
// SETUP
// ======================
marked.setOptions({ headerIds: false, mangle: false, gfm: true });

// Create output directories (recursive handles existing dirs safely)
BUILD_CONFIGS.forEach(cfg => {
  fs.mkdirSync(cfg.outDir, { recursive: true });
});

// ======================
// CORE FUNCTIONS
// ======================
/**
 * Process single Markdown file into HTML
 * @param {string} filePath - Absolute path to source .md file
 * @param {import('./build-configs.js').BuildConfig} config
 * @returns {string|null} Physical output path (for index) or null on skip/error
 */
function processFile(filePath, config) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { attributes, body } = fm(fileContent);
    const htmlContent = marked(body);
    const baseName = path.basename(filePath, '.md');
    const fileName = `${baseName}.html`;
    const isIndex = fileName === 'index.html';

    // Validate required front-matter
    const fieldsToValidate = isIndex
    ? config.requiredFields.filter(f => !['datePublished', 'dateModified'].includes(f))
    : config.requiredFields;

    const missing = fieldsToValidate.filter(f => !attributes[f]);
    if (missing.length) {
      console.warn(`⚠️ Skipping ${config.name}/${path.basename(filePath)}: Missing [${missing.join(', ')}]`);
      return null;
    }

    // URL rationale: Trailing slash for directory indexes aligns with RFC 3986 and HTTP spec
    const templateUrl = isIndex
    ? `/${config.name}/`
    : `/${config.name}/${fileName}`;

    // Physical path for filename index (distinct from semantic URL)
    const indexPathEntry = `/${config.name}/${fileName}`;
    const outPath = path.join(config.outDir, fileName);

    // Apply template replacements (escape placeholders for regex safety)
    let template = fs.readFileSync(config.template, 'utf8');
    const replacements = {
      '{{TITLE}}': String(attributes.title ?? '').trim(),
      '{{DESCRIPTION}}': String(attributes.description ?? '').trim(),
      '{{HERO}}': String(attributes.hero ?? '').trim() || String(attributes.title ?? '').trim(),
      '{{DATE_PUBLISHED}}': String(attributes.datePublished ?? '').trim(),
      '{{DATE_MODIFIED}}': String(attributes.dateModified ?? '').trim(),
      '{{URL}}': templateUrl,
      '{{ARTICLE_CONTENT}}': htmlContent.trim()
    };

    Object.entries(replacements).forEach(([ph, val]) => {
      const safePh = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      template = template.replace(new RegExp(safePh, 'g'), val);
    });

    fs.writeFileSync(outPath, template);
    console.log(`✅ Built ${config.name}: ${fileName} → ${templateUrl}`);
    return indexPathEntry;
  } catch (error) {
    console.error(`❌ ${config.name} error (${path.basename(filePath)}):`, error.message);
    return null;
  }
}

/**
 * Remove orphaned .html files (no matching .md in source) and log deletions
 * @param {import('./build-configs.js').BuildConfig} config
 */
function cleanupOrphanedHtml(config) {
  if (!fs.existsSync(config.outDir)) return;

  // Get current .html files in output
  const htmlFiles = fs.readdirSync(config.outDir).filter(f => f.endsWith('.html'));

  // Build set of valid .md base names from source (if accessible)
  const validMdBases = new Set();
  if (fs.existsSync(config.srcDir)) {
    const mdFiles = fs.readdirSync(config.srcDir).filter(f => f.endsWith('.md'));
    mdFiles.forEach(f => validMdBases.add(path.basename(f, '.md')));
  }

  // Delete/log only orphaned files
  htmlFiles.forEach(htmlFile => {
    const baseName = path.basename(htmlFile, '.html');
    if (!validMdBases.has(baseName)) {
      const fullPath = path.join(config.outDir, htmlFile);
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Removed orphan: ${config.name}/${htmlFile}`);
    }
  });
}

/**
 * Build all files for a configuration section
 * @param {import('./build-configs.js').BuildConfig} config
 * @returns {string[]} Physical paths of successfully built files
 */
function buildConfig(config) {
  cleanupOrphanedHtml(config);
  if (!fs.existsSync(config.srcDir)) {
    console.warn(`⚠️ Skipping ${config.name}: Source directory missing`);
    return [];
  }

  const mdFiles = fs.readdirSync(config.srcDir).filter(f => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    console.warn(`⚠️ No .md files in ${config.srcDir}`);
    return [];
  }

  console.log(`🔨 Building ${mdFiles.length} ${config.name} page(s)...`);
  const generatedPaths = [];

  mdFiles.forEach(file => {
    const result = processFile(path.join(config.srcDir, file), config);
    if (result) generatedPaths.push(result);
  });

    // Generate JS index file (excludes index.html, sorted for VCS stability)
    if (config.generateIndexFile && config.indexOutputPath && config.indexVariableName) {
      const filteredPaths = generatedPaths.filter(p => path.basename(p) !== 'index.html');
      filteredPaths.sort();
      const jsContent = `export const ${config.indexVariableName} = ${JSON.stringify(filteredPaths, null, 2)}\n`;
      fs.writeFileSync(config.indexOutputPath, jsContent);
      console.log(`📝 Generated index (${filteredPaths.length} items): ${path.relative(__dirname, config.indexOutputPath)}`);
    }

    console.log(`✨ ${config.name} build complete`);
    return generatedPaths;
}

// ======================
// EXECUTION
// ======================
console.log('🚀 Starting build...\n');
BUILD_CONFIGS.forEach(buildConfig);
console.log('\n✅ Initial build finished');

if (IS_LIVE_MODE) {
  console.log(`\n👀 Live mode active | HTTP server: http://${HTTP_SERVER_HOST}:${HTTP_SERVER_PORT}\n`);

  const { spawn } = require('child_process');
  let serverProcess = null;

  try {
    serverProcess = spawn('python3', [
      '-m', 'http.server', String(HTTP_SERVER_PORT), '-b', HTTP_SERVER_HOST
    ], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    serverProcess.stdout.on('data', data => console.log(`[HTTP] ${data.toString().trim()}`));
    serverProcess.stderr.on('data', data => console.error(`[HTTP] ${data.toString().trim()}`));
    serverProcess.on('error', err => {
      console.warn(`⚠️ HTTP server failed: ${err.message}\n   (Ensure Python 3 is installed. Live mode continues without server.)`);
      serverProcess = null;
    });

    let cleanupExecuted = false;
    const cleanup = () => {
      if (cleanupExecuted || !serverProcess?.kill) return;
      cleanupExecuted = true;
      try { serverProcess.kill(); } catch (e) { /* silent fail */ }
      console.log('\n👋 HTTP server stopped');
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  } catch (err) {
    console.warn(`⚠️ Failed to start HTTP server: ${err.message}`);
  }

  // Watch source directories with POSIX-normalized globs (chokidar requirement)
  BUILD_CONFIGS.forEach(config => {
    if (fs.existsSync(config.srcDir)) {
      let rebuildDebounce;
      const watchPattern = path.join(config.srcDir, '*.md').replace(/\\/g, '/');

      chokidar.watch(watchPattern, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
        persistent: true
      }).on('all', (event, filePath) => {
        clearTimeout(rebuildDebounce);
        rebuildDebounce = setTimeout(() => {
          console.log(`\n🔄 Change detected in ${config.name} (${event}: ${path.basename(filePath)})`);
          buildConfig(config);
        }, 250);
      });

      console.log(`🔄 Live reloading active for: ${config.srcDir} (monitoring .md files)`);
    }
  });
}
