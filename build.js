#!/usr/bin/env node

// ----------------------------------------
// https://github.com/FaridZelli
// ----------------------------------------

// build.js
const fs = require('fs');
const path = require('path');
const fm = require('front-matter');
const { marked } = require('marked');
const chokidar = require('chokidar');

// ======================
// CONFIGURATION & SETUP
// ======================
const CONFIG_FILE = './build-config.js';

/** @typedef {import('./build-config.js').BuildConfig} BuildConfig */

const rawConfig = require(CONFIG_FILE);
const IS_LIVE_MODE = process.argv.includes('--live');
const HTTP_SERVER_PORT = 8000;
const HTTP_SERVER_HOST = '127.0.0.1';
const BASE_DIR = __dirname;

function safePath(base, relativePath) {
  const resolved = path.resolve(base, relativePath);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`🛑 Security Error: Path "${relativePath}" attempts to access files outside the allowed directory.`);
  }
  return resolved;
}

const WORKING_DIR = safePath(BASE_DIR, rawConfig.workingDir || '.');
const WEB_DIR = rawConfig.webDir ? safePath(BASE_DIR, rawConfig.webDir) : WORKING_DIR;
const resolvePath = (p) => p ? safePath(WORKING_DIR, p) : undefined;

const BUILD_CONFIGS = rawConfig.configs.map(cfg => ({
  ...cfg,
  srcDir: resolvePath(cfg.srcDir),
  outDir: resolvePath(cfg.outDir),
  template: resolvePath(cfg.template),
  indexOutputPath: resolvePath(cfg.indexOutputPath),
  extensions: (cfg.extensions || []).map(ext => resolvePath(ext))
}));

marked.setOptions({ headerIds: false, mangle: false, gfm: true });

BUILD_CONFIGS.forEach(cfg => {
  if (cfg.outDir) fs.mkdirSync(cfg.outDir, { recursive: true });
});

// ======================
// CORE FUNCTIONS
// ======================

function loadExtensions(config) {
  if (!Array.isArray(config.extensions)) return [];

  const loaded = [];
  config.extensions.forEach(extAbsPath => {
    try {
      if (IS_LIVE_MODE) delete require.cache[require.resolve(extAbsPath)];
      const ext = require(extAbsPath);

      if (ext.id && typeof ext.render === 'function') {
        loaded.push(ext);
      } else if (typeof ext === 'object' && ext !== null) {
        for (const [id, render] of Object.entries(ext)) {
          if (typeof render === 'function') loaded.push({ id, render });
        }
      } else {
        console.warn(`⚠️ Extension "${extAbsPath}" has an invalid format.`);
      }
    } catch (err) {
      console.error(`❌ Failed to load extension "${extAbsPath}":`, err.message);
    }
  });
  return loaded;
}

function processFile(parsed, config, extensions) {
  const { filePath, attributes, body, fileName, indexPathEntry, templateUrl } = parsed;
  try {
    const htmlContent = marked(body);
    const outPath = path.join(config.outDir, fileName);

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

    // Render Extensions
    extensions.forEach(ext => {
      const safeId = ext.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bid\\s*=\\s*(?:"${safeId}"|'${safeId}')[^>]*(?:\\/>\\s*|>\\s*<\\/\\1>)`,
        'gi'
      );

      let rendered;
      try {
        // Pass only bare minimum current-page context
        rendered = ext.render({
          attributes,
          fileName: indexPathEntry
        });
      } catch (err) {
        console.error(`❌ Extension "${ext.id}" failed to render:`, err.message);
        return;
      }

      if (rendered !== undefined && rendered !== null) {
        const newTemplate = template.replace(regex, () => String(rendered));
        if (newTemplate !== template) {
          template = newTemplate;
          console.log(`✨ Rendered widget: ${ext.id} in ${fileName}`);
        }
      }
    });

    fs.writeFileSync(outPath, template);
    console.log(`✅ Built ${config.name}: ${fileName} → ${templateUrl}`);
  } catch (error) {
    console.error(`❌ ${config.name} error (${path.basename(filePath)}):`, error.message);
  }
}

function cleanupOrphanedHtml(config) {
  if (!fs.existsSync(config.outDir)) return;
  const htmlFiles = fs.readdirSync(config.outDir).filter(f => f.endsWith('.html'));
  const validMdBases = new Set();
  if (fs.existsSync(config.srcDir)) {
    fs.readdirSync(config.srcDir).filter(f => f.endsWith('.md')).forEach(f => validMdBases.add(path.basename(f, '.md')));
  }
  htmlFiles.forEach(htmlFile => {
    if (!validMdBases.has(path.basename(htmlFile, '.html'))) {
      fs.unlinkSync(path.join(config.outDir, htmlFile));
      console.log(`🗑️ Removed orphan: ${config.name}/${htmlFile}`);
    }
  });
}

// ======================
// EXECUTION
// ======================

function runBuild() {
  console.log('🚀 Starting build...\n');

  BUILD_CONFIGS.forEach(config => {
    if (!config.srcDir || !config.outDir || !config.template) {
      console.warn(`⚠️ Skipping ${config.name}: Missing required paths.`);
      return;
    }

    cleanupOrphanedHtml(config);
    if (!fs.existsSync(config.srcDir)) {
      console.warn(`⚠️ Skipping ${config.name}: Source directory missing`);
      return;
    }

    const mdFiles = fs.readdirSync(config.srcDir).filter(f => f.endsWith('.md'));
    const parsedFiles = [];
    const metadataList = [];

    mdFiles.forEach(file => {
      const filePath = path.join(config.srcDir, file);
      try {
        const { attributes, body } = fm(fs.readFileSync(filePath, 'utf8'));
        const fileName = `${path.basename(filePath, '.md')}.html`;
        const isIndex = fileName === 'index.html';

        const fieldsToValidate = isIndex
        ? config.requiredFields.filter(f => !['datePublished', 'dateModified'].includes(f))
        : config.requiredFields;

        const missing = fieldsToValidate.filter(f => !attributes[f]);
        if (missing.length) {
          console.warn(`⚠️ Skipping ${config.name}/${file}: Missing [${missing.join(', ')}]`);
          return;
        }

        const templateUrl = isIndex ? `/${config.name}/` : `/${config.name}/${fileName}`;
        const indexPathEntry = `/${config.name}/${fileName}`;

        parsedFiles.push({ filePath, attributes, body, fileName, indexPathEntry, templateUrl, isIndex });

        if (!isIndex) {
          metadataList.push({
            fileName: indexPathEntry,
            title: String(attributes.title ?? '').trim(),
            description: String(attributes.description ?? '').trim(),
            dateString: String(attributes.datePublished ?? '').trim(),
            dateModified: String(attributes.dateModified ?? '').trim()
          });
        }
      } catch (error) {
        console.error(`❌ ${config.name} parse error (${file}):`, error.message);
      }
    });

    if (config.generateIndexFile && config.indexOutputPath && metadataList.length > 0) {
      const sortedMetadata = [...metadataList].sort((a, b) => a.fileName.localeCompare(b.fileName));
      fs.writeFileSync(config.indexOutputPath, JSON.stringify(sortedMetadata, null, 2));
      console.log(`📝 Generated JSON index (${sortedMetadata.length} items) for ${config.name}: ${path.relative(WORKING_DIR, config.indexOutputPath)}`);
    }

    if (parsedFiles.length === 0) return;

    const extensions = loadExtensions(config);
    console.log(`🔨 Building ${parsedFiles.length} ${config.name} page(s)...`);

    parsedFiles.forEach(parsed => {
      processFile(parsed, config, extensions);
    });

    console.log(`✨ ${config.name} build complete`);
  });

  console.log('\n✅ Build finished');
}

runBuild();

if (IS_LIVE_MODE) {
  console.log(`\n👀 Live mode active | HTTP server: http://${HTTP_SERVER_HOST}:${HTTP_SERVER_PORT}\n`);
  const { spawn } = require('child_process');
  let serverProcess = null;

  try {
    serverProcess = spawn('python3', ['-m', 'http.server', String(HTTP_SERVER_PORT), '-b', HTTP_SERVER_HOST], {
      cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'], shell: false
    });
    serverProcess.stdout.on('data', data => console.log(`[HTTP] ${data.toString().trim()}`));
    serverProcess.stderr.on('data', data => console.error(`[HTTP] ${data.toString().trim()}`));
    serverProcess.on('error', err => {
      console.warn(`⚠️ HTTP server failed: ${err.message}`);
      serverProcess = null;
    });

    let cleanupExecuted = false;
    const cleanup = () => {
      if (cleanupExecuted || !serverProcess?.kill) return;
      cleanupExecuted = true;
      try { serverProcess.kill(); } catch (e) { }
      console.log('\n👋 HTTP server stopped');
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  } catch (err) {
    console.warn(`⚠️ Failed to start HTTP server: ${err.message}`);
  }

  const watchPatterns = BUILD_CONFIGS
  .filter(c => c.srcDir && fs.existsSync(c.srcDir))
  .map(c => path.join(c.srcDir, '*.md').replace(/\\/g, '/'));

  if (watchPatterns.length > 0) {
    let rebuildDebounce;
    chokidar.watch(watchPatterns, {
      ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }, persistent: true
    }).on('all', (event, filePath) => {
      clearTimeout(rebuildDebounce);
      rebuildDebounce = setTimeout(() => {
        console.log(`\n🔄 Change detected (${event}: ${path.basename(filePath)})`);
        runBuild();
      }, 250);
    });
    console.log(`🔄 Live reloading active (monitoring .md files)`);
  }
}
