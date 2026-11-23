#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { parseFrontMatter } = require('./lib/front-matter');
const { startLiveMode } = require('./lib/live-mode');

const BASE_DIR = __dirname;
const CONFIG_PATH = path.resolve(BASE_DIR, 'build-config.js');
const IS_LIVE_MODE = process.argv.includes('--live');

// Configure Marked once at startup to enable GitHub Flavored Markdown tables and syntax.
marked.use({ gfm: true });

// ============================================================================
// Shared Utilities
// ============================================================================

// Resolves a relative path against baseDir and throws if the result escapes baseDir.
// This prevents accidental or malicious path traversal across config files, extensions, and live previewing.
function safePath(baseDir, targetPath) {
  if (typeof targetPath !== 'string' || targetPath.includes('\0')) {
    throw new Error(`Invalid path value: "${String(targetPath)}".`);
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  const relative = path.relative(resolvedBase, resolvedTarget);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security error: "${targetPath}" resolves outside "${resolvedBase}".`);
  }

  return resolvedTarget;
}

// Escapes special HTML characters so metadata inserted into attributes or text nodes stays safe.
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escapes regular expression metacharacters so literal IDs or tokens can be matched safely.
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Converts a camelCase or kebab-case field name (such as datePublished) into UPPER_SNAKE_CASE (DATE_PUBLISHED).
function toPlaceholderKey(fieldName) {
  return String(fieldName)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

// ============================================================================
// Stage 1: Load and Validate Configuration
// ============================================================================

// Reads build-config.js, validates required structure, and resolves every path once up front.
// Downstream build stages rely exclusively on this normalized configuration object.
function loadConfig(configPath, isLiveMode) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found at "${configPath}".`);
  }

  if (isLiveMode) {
    delete require.cache[require.resolve(configPath)];
  }

  const raw = require(configPath);

  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) {
    throw new Error('Configuration must export an object containing a "sections" array.');
  }

  const workingDir = safePath(BASE_DIR, raw.workingDir || '.');
  const webDir = safePath(workingDir, raw.webDir || 'public');
  const resolveInWorkingDir = (relativePath) => safePath(workingDir, relativePath);

  // Validate and normalize each content section so later stages never need defensive path checks.
  const sections = raw.sections.map((section, index) => {
    if (!section.name || !section.srcDir || !section.outDir || !section.template) {
      throw new Error(`Section #${index + 1} must define "name", "srcDir", "outDir", and "template".`);
    }

    const requiredFields = Array.isArray(section.requiredFields) ? section.requiredFields : [];
    const indexRequiredFields = Array.isArray(section.indexRequiredFields)
      ? section.indexRequiredFields
      : requiredFields;

    return {
      name: String(section.name),
      srcDir: resolveInWorkingDir(section.srcDir),
      outDir: resolveInWorkingDir(section.outDir),
      template: resolveInWorkingDir(section.template),
      requiredFields,
      indexRequiredFields,
      cleanOrphans: section.cleanOrphans !== false
    };
  });

  // Deduplicate extension paths so each extension module is loaded and executed once per build.
  const extensionPaths = Array.isArray(raw.extensions)
    ? [...new Set(raw.extensions.map(resolveInWorkingDir))]
    : [];

  return {
    workingDir,
    webDir,
    contentPlaceholder: toPlaceholderKey(raw.contentPlaceholder || 'CONTENT'),
    defaults: raw.defaults && typeof raw.defaults === 'object' ? raw.defaults : {},
    fieldFallbacks: raw.fieldFallbacks && typeof raw.fieldFallbacks === 'object' ? raw.fieldFallbacks : {},
    server: {
      host: raw.server?.host || '127.0.0.1',
      port: Number(raw.server?.port) || 8000
    },
    extensions: extensionPaths,
    sections
  };
}

// ============================================================================
// Stage 2: Collect and Parse Markdown Pages
// ============================================================================

// Computes a clean public URL path (such as "/" or "/articles/guide.html") from a file's path inside webDir.
function computePageUrl(webDir, outPath, isIndex) {
  const relativePath = path.relative(webDir, outPath).split(path.sep).join('/');

  if (isIndex) {
    const dirName = path.posix.dirname(relativePath);
    return dirName === '.' ? '/' : `/${dirName}/`;
  }

  return `/${relativePath}`;
}

// Scans every configured section, parses its Markdown files, validates required front-matter fields,
// and returns a unified view of all pages grouped both by section name and as a flat array.
function collectPages(config) {
  const sections = {};
  const pages = [];
  const warnings = [];

  for (const section of config.sections) {
    sections[section.name] = [];

    if (!fs.existsSync(section.srcDir)) {
      warnings.push(`Skipped section "${section.name}": source directory does not exist.`);
      continue;
    }

    const mdFiles = fs
      .readdirSync(section.srcDir)
      .filter((file) => file.endsWith('.md'))
      .sort();

    for (const mdFile of mdFiles) {
      const srcPath = path.join(section.srcDir, mdFile);
      const rawContent = fs.readFileSync(srcPath, 'utf8');
      const { attributes, body } = parseFrontMatter(rawContent);

      const fileName = `${path.basename(mdFile, '.md')}.html`;
      const isIndex = fileName === 'index.html';
      const outPath = path.join(section.outDir, fileName);

      // Validate the page against the section's configured required fields.
      const requiredFields = isIndex ? section.indexRequiredFields : section.requiredFields;
      const missingFields = requiredFields.filter((field) => {
        const value = attributes[field];
        return value === undefined || value === null || String(value).trim() === '';
      });

      if (missingFields.length > 0) {
        warnings.push(`Skipped ${section.name}/${mdFile}: missing required fields [${missingFields.join(', ')}].`);
        continue;
      }

      const page = {
        section: section.name,
        srcPath,
        outPath,
        fileName,
        isIndex,
        url: computePageUrl(config.webDir, outPath, isIndex),
        attributes,
        body
      };

      sections[section.name].push(page);
      pages.push(page);
    }
  }

  return { sections, pages, warnings };
}

// ============================================================================
// Stage 3: Load Extensions and Build the Site API
// ============================================================================

// Creates the read-only data and sandboxed helper API passed to every extension hook and widget.
function createSiteApi(config, collected) {
  return {
    config: {
      workingDir: config.workingDir,
      webDir: config.webDir,
      defaults: { ...config.defaults }
    },
    sections: collected.sections,
    pages: collected.pages,

    // Returns a shallow copy of all collected pages belonging to a specific section.
    getPages(sectionName) {
      return [...(collected.sections[sectionName] || [])];
    },

    // Safely writes an auxiliary file (such as source/index.json) inside the project's workingDir.
    writeFile(relativePath, content) {
      const destination = safePath(config.workingDir, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, 'utf8');
    },

    utils: { escapeHtml }
  };
}

// Loads each configured extension module, validates its exports, and runs its optional onBuild hook.
function loadExtensions(config, site, isLiveMode) {
  const loaded = [];
  const warnings = [];

  for (const extPath of config.extensions) {
    try {
      if (isLiveMode) {
        delete require.cache[require.resolve(extPath)];
      }

      const extModule = require(extPath);
      if (!extModule || typeof extModule !== 'object') {
        warnings.push(`Ignored extension "${path.basename(extPath)}": module must export an object.`);
        continue;
      }

      const extension = {
        name: extModule.name || path.basename(extPath, '.js'),
        onBuild: typeof extModule.onBuild === 'function' ? extModule.onBuild : null,
        widgets: extModule.widgets && typeof extModule.widgets === 'object' ? extModule.widgets : {}
      };

      if (extension.onBuild) {
        extension.onBuild(site);
      }

      loaded.push(extension);
    } catch (error) {
      warnings.push(`Extension error (${path.basename(extPath)}): ${error.message}`);
    }
  }

  return { extensions: loaded, warnings };
}

// ============================================================================
// Stage 4: Render Templates, Inject Content, and Clean Orphans
// ============================================================================

// Builds the complete placeholder lookup map for a page from config defaults, front matter, and fallbacks.
function buildPlaceholderMap(page, config) {
  const merged = {
    ...config.defaults,
    ...page.attributes,
    pageUrl: page.url
  };

  // Apply configured field fallbacks whenever a target field is missing or blank.
  for (const [targetField, fallbackField] of Object.entries(config.fieldFallbacks)) {
    const currentValue = merged[targetField];
    if (currentValue === undefined || currentValue === null || String(currentValue).trim() === '') {
      merged[targetField] = merged[fallbackField] ?? '';
    }
  }

  const placeholders = {};
  for (const [key, value] of Object.entries(merged)) {
    placeholders[toPlaceholderKey(key)] = value === undefined || value === null ? '' : String(value).trim();
  }

  return placeholders;
}

// Renders a single page by filling template placeholders, injecting Markdown HTML, and executing matching widgets.
function renderPage(page, templateHtml, config, site, extensions) {
  const placeholders = buildPlaceholderMap(page, config);

  // Step 1: Replace metadata placeholders before injecting Markdown so {{tokens}} inside articles stay untouched.
  let html = templateHtml.replace(/\{\{(raw:)?([A-Z0-9_]+)\}\}/g, (match, rawPrefix, key) => {
    if (key === config.contentPlaceholder) {
      return match;
    }

    const value = placeholders[key] ?? '';
    return rawPrefix ? value : escapeHtml(value);
  });

  // Step 2: Convert Markdown to HTML and inject it safely using a callback to avoid "$" pattern issues.
  const renderedMarkdown = marked.parse(page.body).trim();
  const contentPattern = new RegExp(`\\{\\{${escapeRegExp(config.contentPlaceholder)}\\}\\}`, 'g');
  html = html.replace(contentPattern, () => renderedMarkdown);

  // Step 3: Evaluate only the extension widgets whose target element ID exists in the rendered page.
  for (const extension of extensions) {
    for (const [widgetId, renderWidget] of Object.entries(extension.widgets)) {
      if (typeof renderWidget !== 'function') {
        continue;
      }

      const safeId = escapeRegExp(widgetId);
      const elementPattern = new RegExp(
        `<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bid\\s*=\\s*(?:"${safeId}"|'${safeId}')[^>]*(?:\\/>|>\\s*<\\/\\1>)`,
        'gi'
      );

      if (!elementPattern.test(html)) {
        continue;
      }

      elementPattern.lastIndex = 0;

      const widgetOutput = renderWidget(page, site);
      if (widgetOutput !== undefined && widgetOutput !== null) {
        html = html.replace(elementPattern, () => String(widgetOutput));
      }
    }
  }

  return html;
}

// Removes stale .html files from output directories when their source Markdown files no longer exist.
// Uses the full set of generated output paths so sections sharing an outDir never delete each other's files.
function cleanOrphanedHtml(config, generatedPages) {
  const expectedOutputs = new Set(generatedPages.map((page) => page.outPath));
  const cleanedDirs = new Set();
  const removedFiles = [];

  for (const section of config.sections) {
    if (!section.cleanOrphans || cleanedDirs.has(section.outDir) || !fs.existsSync(section.outDir)) {
      continue;
    }

    cleanedDirs.add(section.outDir);

    for (const entry of fs.readdirSync(section.outDir)) {
      if (!entry.endsWith('.html')) {
        continue;
      }

      const fullPath = path.join(section.outDir, entry);
      if (!expectedOutputs.has(fullPath) && fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        removedFiles.push(path.relative(config.workingDir, fullPath));
      }
    }
  }

  return removedFiles;
}

// Renders every collected page to disk using a per-build template cache and cleans orphaned outputs.
function writeRenderedPages(config, site, extensions) {
  const templateCache = new Map();
  const warnings = [];
  let builtCount = 0;

  for (const section of config.sections) {
    fs.mkdirSync(section.outDir, { recursive: true });

    const sectionPages = site.sections[section.name] || [];
    if (sectionPages.length === 0) {
      continue;
    }

    if (!fs.existsSync(section.template)) {
      warnings.push(`Skipped section "${section.name}": template "${section.template}" not found.`);
      continue;
    }

    if (!templateCache.has(section.template)) {
      templateCache.set(section.template, fs.readFileSync(section.template, 'utf8'));
    }

    const templateHtml = templateCache.get(section.template);

    for (const page of sectionPages) {
      try {
        const finalHtml = renderPage(page, templateHtml, config, site, extensions);
        fs.writeFileSync(page.outPath, finalHtml, 'utf8');
        builtCount += 1;
      } catch (error) {
        warnings.push(`Failed to render ${page.section}/${page.fileName}: ${error.message}`);
      }
    }
  }

  const removedFiles = cleanOrphanedHtml(config, site.pages);

  return { builtCount, removedFiles, warnings };
}

// ============================================================================
// Pipeline Entry Point
// ============================================================================

// Executes the complete top-down build pipeline and prints a concise summary.
function runBuild() {
  const startTime = Date.now();
  const config = loadConfig(CONFIG_PATH, IS_LIVE_MODE);
  const collected = collectPages(config);
  const site = createSiteApi(config, collected);
  const { extensions, warnings: extWarnings } = loadExtensions(config, site, IS_LIVE_MODE);
  const { builtCount, removedFiles, warnings: renderWarnings } = writeRenderedPages(config, site, extensions);

  const allWarnings = [...collected.warnings, ...extWarnings, ...renderWarnings];
  const elapsedMs = Date.now() - startTime;

  for (const warning of allWarnings) {
    console.warn(`  [warn] ${warning}`);
  }

  for (const removed of removedFiles) {
    console.log(`  [removed] ${removed}`);
  }

  console.log(`Built ${builtCount} page(s) across ${config.sections.length} section(s) in ${elapsedMs}ms.`);
  return config;
}

// Runs a single build and optionally transitions into live server and watch mode.
function main() {
  let config;

  try {
    config = runBuild();
  } catch (error) {
    console.error(`Build error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (IS_LIVE_MODE) {
    startLiveMode({
      config,
      configPath: CONFIG_PATH,
      onRebuild: runBuild,
      safePath
    });
  }
}

main();
