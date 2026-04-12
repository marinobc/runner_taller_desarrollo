'use strict';

class Minifier {

  // ─────────────────────────────────────────────────────────────
  // Routing tables
  // ─────────────────────────────────────────────────────────────

  static FULL_MINIFY = new Set([
    'java', 'gradle', 'groovy',
    'ts', 'js',
    'css', 'scss',
    'json', 'jsonc'
  ]);

  static XML_MINIFY = new Set([
    'vue', 'xml', 'pom', 'html', 'htm', 'svg'
  ]);

  // Indentation/line-sensitive: strip comments only, preserve all whitespace.
  static INDENT_ONLY = new Set([
    'py', 'pyw',
    'yml', 'yaml',
    'properties'
  ]);

  // Operators safe for space compaction.
  // '/' intentionally excluded — indistinguishable from regex literals without a full parser.
  static OPERATORS = [
    '{', '}', '(', ')', '[', ']',
    ',', ';', ':', '=', '+', '-', '*',
    '<', '>', '|', '&', '!', '?', '.', '%', '^'
  ];

  static HTML_SAFE_OPERATORS = [
    '(', ')', '[', ']',
    ',', ';', '=', '+', '-', '*',
    '|', '&', '!', '?', '.', '%', '^'
  ];

  // ─────────────────────────────────────────────────────────────
  // Public entry point
  // ─────────────────────────────────────────────────────────────

  /**
   * @param {string} content   Raw file content.
   * @param {string} filename  Used only to derive the file extension.
   * @returns {string}         Minified content, or the original if empty/unknown.
   */
  static minify(content, filename) {
    if (!content) return content;

    const ext = filename.split('.').pop().toLowerCase();

    if (Minifier.FULL_MINIFY.has(ext))  return Minifier._minifyFull(content, false);
    if (Minifier.XML_MINIFY.has(ext))   return Minifier._minifyFull(content, true);
    if (Minifier.INDENT_ONLY.has(ext))  return Minifier._minifyIndentOnly(content);

    // Unknown extension — return untouched to avoid silent corruption.
    return content;
  }

  // ─────────────────────────────────────────────────────────────
  // Pipeline A — full minification
  // Used by: Java, Gradle, TS, JS, Vue, CSS, JSON, XML, POM …
  // ─────────────────────────────────────────────────────────────

  static _minifyFull(content, stripHtmlComments) {
    // Phase 1 — protect all string literals.
    const { skeleton, strings } = Minifier._extractStrings(content);
    
    // Aggressively collapse newlines in strings to achieve a single-line output per file
    const flatStrings = strings.map(str => str.replace(/\r?\n\s*/g, ' '));

    let s = skeleton;

    // Phase 2a — block comments  /* … */
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');

    // Phase 2b — HTML/XML comments  <!-- … -->  (XML_MINIFY bucket only)
    if (stripHtmlComments) {
      s = s.replace(/<!--[\s\S]*?-->/g, '');
    }

    // Phase 2c — line comments  //
    s = Minifier._stripSlashComments(s);

    // Phase 2d — collapse all whitespace runs to a single space
    s = s.replace(/\s+/g, ' ');

    // Phase 2e — remove spaces around operators / delimiters
    const operators = stripHtmlComments ? Minifier.HTML_SAFE_OPERATORS : Minifier.OPERATORS;
    for (const op of operators) {
      const esc = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(`\\s*${esc}\\s*`, 'g'), op);
    }

    // Phase 3 — restore original string literals.
    return Minifier._restoreStrings(s, flatStrings).trim();
  }

  // ─────────────────────────────────────────────────────────────
  // Pipeline B — indent-sensitive (Python, YAML, .properties)
  // Strips # comments only. Every newline and indent is preserved.
  // ─────────────────────────────────────────────────────────────

  static _minifyIndentOnly(content) {
    // Phase 1 — protect string literals so # inside them is never touched.
    const { skeleton, strings } = Minifier._extractStrings(content);

    const stripped = skeleton
      .split('\n')
      .map(line => {
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '#') {
            // Preserve leading whitespace (indentation); drop the comment.
            return line.substring(0, i).trimEnd();
          }
        }
        return line.trimEnd(); // normalise trailing whitespace only
      })
      .join('\n');

    const restored = Minifier._restoreStrings(stripped, strings);

    // Collapse 3+ consecutive blank lines → 2. Cosmetic only, safe for all formats.
    return restored.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ─────────────────────────────────────────────────────────────
  // String extractor — shared by both pipelines
  // ─────────────────────────────────────────────────────────────

  /**
   * Walks the source once and replaces every string literal with __STR_N__.
   *
   * Handles, in priority order:
   *   """…"""  '''…'''  — triple-quoted (Python docstrings, Java text blocks)
   *   `…${…}…`          — JS/TS template literals with nested expression tracking
   *   "…"  '…'          — regular strings; respects \\ escapes
   *
   * @returns {{ skeleton: string, strings: string[] }}
   */
  static _extractStrings(source) {
    const strings = [];
    let skeleton = '';
    let i = 0;

    const pushLiteral = (lit) => {
      const idx = strings.length;
      strings.push(lit);
      skeleton += `__STR_${idx}__`;
    };

    while (i < source.length) {
      const ch = source[i];

      if (ch !== '"' && ch !== "'" && ch !== '`') {
        skeleton += ch;
        i++;
        continue;
      }

      const q = ch;

      // ── Triple-quoted string  (""" / ''' / ```) ──────────────────────────
      if (source[i + 1] === q && source[i + 2] === q) {
        let lit = q + q + q;
        i += 3;

        while (i < source.length) {
          if (source[i] === '\\') {
            lit += source[i] + (source[i + 1] ?? '');
            i += 2;
            continue;
          }
          if (source[i] === q && source[i + 1] === q && source[i + 2] === q) {
            lit += q + q + q;
            i += 3;
            break;
          }
          lit += source[i++];
        }

        pushLiteral(lit);
        continue;
      }

      // ── Template literal  `…` ────────────────────────────────────────────
      if (q === '`') {
        let lit = '`';
        let depth = 0;
        i++;

        while (i < source.length) {
          const c = source[i];
          lit += c;

          if (c === '\\') {
            i++;
            if (i < source.length) { lit += source[i++]; }
            continue;
          }

          if (c === '$' && source[i + 1] === '{') {
            depth++;
            lit += source[++i]; // consume '{'
          } else if (c === '}' && depth > 0) {
            depth--;
          } else if (c === '`' && depth === 0) {
            i++;
            break;
          }

          i++;
        }

        pushLiteral(lit);
        continue;
      }

      // ── Regular single / double quoted string ────────────────────────────
      let lit = q;
      i++;

      while (i < source.length) {
        const c = source[i];
        lit += c;

        if (c === '\\') {
          i++;
          if (i < source.length) { lit += source[i++]; }
          continue;
        }

        if (c === q) { i++; break; }
        i++;
      }

      pushLiteral(lit);
    }

    return { skeleton, strings };
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Strips // line comments from a skeleton (string literals already removed).
   * Guards against URL protocols: http:// and https:// are left alone.
   */
  static _stripSlashComments(source) {
    return source
      .split('\n')
      .map(line => {
        for (let i = 0; i < line.length - 1; i++) {
          if (line[i] === '/' && line[i + 1] === '/') {
            const before = line.substring(0, i);
            if (/https?:$/.test(before)) continue; // URL protocol — not a comment
            return before;
          }
        }
        return line;
      })
      .join('\n');
  }

  /**
   * Restores all __STR_N__ placeholders to their original string literals.
   */
  static _restoreStrings(text, strings) {
    return text.replace(/__STR_(\d+)__/g, (_, idx) => strings[Number(idx)] ?? '');
  }
}

module.exports = Minifier;
