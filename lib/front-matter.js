'use strict';

// Parses a single scalar value from a front-matter line into a clean JavaScript primitive.
// ISO dates (such as 2026-02-20) intentionally remain strings so they never shift across timezones.
function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (value === '' || value === 'null' || value === '~') {
    return '';
  }

  // Handle single-quoted strings and restore YAML's doubled single-quote escape sequence.
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  // Handle double-quoted strings and unescape common control characters.
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // Handle inline YAML arrays written as [item one, item two].
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner.split(',').map((item) => parseScalar(item));
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

// Extracts YAML front matter enclosed by leading "---" delimiters from a Markdown string.
// Returns an object containing the parsed attributes map and the remaining Markdown body.
function parseFrontMatter(rawContent) {
  // Remove a UTF-8 byte order mark if the editor inserted one at the start of the file.
  const content = rawContent.replace(/^\uFEFF/, '');
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);

  if (!match) {
    return { attributes: {}, body: content };
  }

  const attributes = {};
  const lines = match[1].split(/\r?\n/);
  let activeListKey = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comment lines inside the front-matter block.
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Append indented bullet entries (such as "- networking") to the preceding list key.
    if (activeListKey && /^-\s+/.test(trimmed)) {
      attributes[activeListKey].push(parseScalar(trimmed.slice(1)));
      continue;
    }

    // Split on the first colon only so colons inside titles or URLs remain intact.
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      activeListKey = null;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      activeListKey = null;
      continue;
    }

    // A key with an empty value begins a potential multi-line bullet list.
    if (rawValue === '') {
      attributes[key] = [];
      activeListKey = key;
    } else {
      attributes[key] = parseScalar(rawValue);
      activeListKey = null;
    }
  }

  // Convert any empty list key that had no bullet items back into an empty string.
  for (const [key, value] of Object.entries(attributes)) {
    if (Array.isArray(value) && value.length === 0) {
      attributes[key] = '';
    }
  }

  return {
    attributes,
    body: content.slice(match[0].length)
  };
}

module.exports = { parseFrontMatter };
