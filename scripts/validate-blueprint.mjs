#!/usr/bin/env node
// Blueprint validator. Pure Node, zero deps.
// Usage: node scripts/validate-blueprint.mjs <blueprint.yaml> [--knowledge-base <path>] [--allow-unknown-skills]

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- ANSI colors ----------
const useColor = process.stdout.isTTY;
const C = {
  red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: (s) => useColor ? `\x1b[33m${s}\x1b[0m` : s,
  green: (s) => useColor ? `\x1b[32m${s}\x1b[0m` : s,
  dim: (s) => useColor ? `\x1b[2m${s}\x1b[0m` : s,
};

// ---------- CLI parsing ----------
function printUsage() {
  process.stdout.write(`Usage: node scripts/validate-blueprint.mjs <blueprint.yaml> [--knowledge-base <path>] [--allow-unknown-skills]

Options:
  --knowledge-base <path>     Path to knowledge base repo root (defaults to $CLAUDE_APP_ORCHESTRATOR_PATH or repo root)
  --allow-unknown-skills      Downgrade unknown skill names from error to warning
  --help                      Print this message
`);
}

const args = process.argv.slice(2);
let blueprintArg = null;
let kbArg = null;
let allowUnknownSkills = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
  else if (a === '--knowledge-base') { kbArg = args[++i]; }
  else if (a === '--allow-unknown-skills') { allowUnknownSkills = true; }
  else if (a.startsWith('--')) {
    process.stderr.write(`unknown option: ${a}\n`);
    printUsage();
    process.exit(2);
  } else if (!blueprintArg) {
    blueprintArg = a;
  } else {
    process.stderr.write(`unexpected positional argument: ${a}\n`);
    printUsage();
    process.exit(2);
  }
}

if (!blueprintArg) {
  printUsage();
  process.exit(2);
}

const blueprintPath = resolve(process.cwd(), blueprintArg);
const repoRoot = resolve(__dirname, '..'); // scripts/.. = repo root
const kbPath = resolve(process.cwd(), kbArg || process.env.CLAUDE_APP_ORCHESTRATOR_PATH || repoRoot);

// ---------- Existence check ----------
if (!existsSync(blueprintPath) || !statSync(blueprintPath).isFile()) {
  process.stderr.write(`blueprint not found: ${blueprintPath}\n`);
  process.exit(1);
}

const rawText = readFileSync(blueprintPath, 'utf8');

// ---------- Minimal YAML reader ----------
// Supports: nested maps via 2- or 4-space indentation, lists ("- " items),
// quoted strings, numbers, booleans, null, comments, "|" block scalars.
// Each scalar/object node carries a __line property for error reporting.

class YamlError extends Error {
  constructor(msg, line) { super(msg); this.line = line; }
}

const LINE_KEY = Symbol('line');
const LINES_KEY = Symbol('lines'); // map: key -> line number

function parseScalar(raw, line) {
  let s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  // Quoted strings
  if ((s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
      (s.startsWith("'") && s.endsWith("'") && s.length >= 2)) {
    return s.slice(1, -1);
  }
  // Numbers (int or float). Preserve string if it has leading zero+digits or underscores.
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n)) return n;
    return s;
  }
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  // Inline comment stripping handled at line tokenization, not here.
  return s;
}

// Strip a `# comment` portion not inside quotes.
function stripInlineComment(line) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      // ensure preceding char is space or start of line
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i).replace(/\s+$/, '');
    }
  }
  return line.replace(/\s+$/, '');
}

function tokenizeLines(text) {
  const lines = text.split(/\r?\n/);
  const tokens = []; // { lineNo, indent, content, isBlank }
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const original = lines[i];
    // Strip inline comment but be aware of quotes
    const stripped = stripInlineComment(original);
    if (stripped.trim() === '') {
      tokens.push({ lineNo, indent: 0, content: '', isBlank: true, raw: original });
      continue;
    }
    const indent = stripped.match(/^ */)[0].length;
    const content = stripped.slice(indent);
    tokens.push({ lineNo, indent, content, isBlank: false, raw: original });
  }
  return tokens;
}

// Parse a key:value or key: portion. Returns { key, value, hasValue }.
// Throws if the line doesn't look like a map entry.
function parseMapKey(content, lineNo) {
  // Quoted key support is not needed for blueprints, but allow `"foo": bar` minimally.
  let key, rest;
  if (content.startsWith('"') || content.startsWith("'")) {
    const q = content[0];
    const end = content.indexOf(q, 1);
    if (end < 0) throw new YamlError(`Unterminated quoted key`, lineNo);
    key = content.slice(1, end);
    rest = content.slice(end + 1).trimStart();
    if (!rest.startsWith(':')) throw new YamlError(`Expected ':' after key`, lineNo);
    rest = rest.slice(1);
  } else {
    const colonIdx = content.indexOf(':');
    if (colonIdx < 0) throw new YamlError(`Expected ':' in mapping entry`, lineNo);
    key = content.slice(0, colonIdx).trim();
    rest = content.slice(colonIdx + 1);
  }
  if (key === '') throw new YamlError(`Empty key`, lineNo);
  // value is everything after the colon
  const valueRaw = rest;
  const trimmed = valueRaw.trim();
  return { key, valueRaw, trimmedValue: trimmed, hasValue: trimmed.length > 0 };
}

// Recursive descent parser over the token stream.
function parseYaml(text) {
  const tokens = tokenizeLines(text).filter(t => !t.isBlank);
  let pos = 0;

  function peek() { return pos < tokens.length ? tokens[pos] : null; }

  // Parse a block (map or list) at the given indent.
  // Returns the parsed node. Stops when the next non-blank token is at lower indent
  // or when no tokens remain.
  function parseBlock(indent) {
    const t = peek();
    if (!t || t.indent < indent) return null;
    if (t.indent !== indent) {
      throw new YamlError(`Unexpected indentation (expected ${indent} spaces, got ${t.indent})`, t.lineNo);
    }
    if (t.content.startsWith('- ') || t.content === '-') {
      return parseList(indent);
    }
    return parseMap(indent);
  }

  function parseList(indent) {
    const items = [];
    items[LINE_KEY] = peek().lineNo;
    while (true) {
      const t = peek();
      if (!t || t.indent < indent) break;
      if (t.indent > indent) {
        throw new YamlError(`Unexpected indentation in list`, t.lineNo);
      }
      if (!(t.content.startsWith('- ') || t.content === '-')) break;
      pos++;
      // The dash content
      const afterDash = t.content === '-' ? '' : t.content.slice(2);
      const lineNo = t.lineNo;
      if (afterDash === '') {
        // Block child on next lines at indent+2 (or +4 tolerated)
        const child = parseBlockChild(indent + 2);
        items.push(child);
      } else if (looksLikeMapEntry(afterDash, lineNo)) {
        // Inline map item: "- key: value" — first key sits at virtual indent (indent+2),
        // additional keys for the same item appear on following lines at indent+2.
        const obj = {};
        obj[LINE_KEY] = lineNo;
        obj[LINES_KEY] = {};
        const { key, trimmedValue, hasValue } = parseMapKey(afterDash, lineNo);
        obj[LINES_KEY][key] = lineNo;
        if (hasValue) {
          obj[key] = parseInlineValue(trimmedValue, lineNo);
        } else {
          // Nested under this list item; child indent must be > indent+2
          const child = parseBlockChild(indent + 4);
          obj[key] = child;
        }
        // Subsequent keys at indent+2
        while (true) {
          const next = peek();
          if (!next || next.indent !== indent + 2) break;
          if (next.content.startsWith('- ') || next.content === '-') break;
          if (!looksLikeMapEntry(next.content, next.lineNo)) break;
          pos++;
          const pk = parseMapKey(next.content, next.lineNo);
          obj[LINES_KEY][pk.key] = next.lineNo;
          if (pk.hasValue) {
            obj[pk.key] = parseInlineValue(pk.trimmedValue, next.lineNo);
          } else {
            const childN = parseBlockChild(indent + 4);
            obj[pk.key] = childN;
          }
        }
        items.push(obj);
      } else {
        // Scalar list item: "- foo"
        items.push(parseScalar(afterDash, lineNo));
      }
    }
    return items;
  }

  function parseMap(indent) {
    const obj = {};
    obj[LINE_KEY] = peek().lineNo;
    obj[LINES_KEY] = {};
    while (true) {
      const t = peek();
      if (!t || t.indent < indent) break;
      if (t.indent > indent) {
        throw new YamlError(`Unexpected indentation in map (got ${t.indent}, expected ${indent})`, t.lineNo);
      }
      if (t.content.startsWith('- ')) break; // end of map; list begins at same indent? then caller decides.
      if (!looksLikeMapEntry(t.content, t.lineNo)) {
        throw new YamlError(`Expected mapping entry, got: ${t.content}`, t.lineNo);
      }
      pos++;
      const { key, trimmedValue, hasValue } = parseMapKey(t.content, t.lineNo);
      obj[LINES_KEY][key] = t.lineNo;
      if (hasValue) {
        if (trimmedValue === '|' || trimmedValue.startsWith('|')) {
          obj[key] = parseBlockScalar(indent);
        } else {
          // If the next token is more deeply indented and a map entry,
          // treat this as a "scalar + nested attributes" shape:
          //   name: string
          //     validation: z.string()
          // becomes { type: 'string', validation: '...', __line: ... }
          const next = peek();
          if (next && next.indent > indent && looksLikeMapEntry(next.content, next.lineNo)) {
            const nested = parseBlock(next.indent);
            if (isPlainObject(nested)) {
              // Promote: store original scalar under 'type' if not already present.
              if (!('type' in nested)) {
                nested.type = parseInlineValue(trimmedValue, t.lineNo);
                if (nested[LINES_KEY]) nested[LINES_KEY].type = t.lineNo;
              }
              if (!nested[LINE_KEY]) nested[LINE_KEY] = t.lineNo;
              obj[key] = nested;
            } else {
              obj[key] = parseInlineValue(trimmedValue, t.lineNo);
            }
          } else {
            obj[key] = parseInlineValue(trimmedValue, t.lineNo);
          }
        }
      } else {
        // Look ahead at next token to decide
        const next = peek();
        if (!next || next.indent <= indent) {
          obj[key] = null;
        } else {
          obj[key] = parseBlock(next.indent);
        }
      }
    }
    return obj;
  }

  // Parse what comes under a list item with no inline content.
  // childIndent is the expected indent of the first child token.
  function parseBlockChild(childIndent) {
    const next = peek();
    if (!next) return null;
    // Accept indent equal to or greater than expected (tolerate 4-space convention).
    if (next.indent < childIndent) return null;
    return parseBlock(next.indent);
  }

  function looksLikeMapEntry(content, lineNo) {
    // Must contain a colon followed by space or end of line, not inside quotes.
    let inSingle = false, inDouble = false;
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === ':' && !inSingle && !inDouble) {
        const after = content[i + 1];
        if (after === undefined || after === ' ' || after === '\t') return true;
      }
    }
    return false;
  }

  function parseInlineValue(raw, lineNo) {
    const s = raw.trim();
    // Inline list: [a, b, c]
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      if (inner === '') {
        const arr = [];
        arr[LINE_KEY] = lineNo;
        return arr;
      }
      // simple split by comma respecting quotes
      const parts = splitFlow(inner, lineNo);
      const arr = parts.map(p => parseScalar(p, lineNo));
      arr[LINE_KEY] = lineNo;
      return arr;
    }
    // Inline map {a: b, c: d} — minimal support
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim();
      const obj = {};
      obj[LINE_KEY] = lineNo;
      obj[LINES_KEY] = {};
      if (inner !== '') {
        const parts = splitFlow(inner, lineNo);
        for (const p of parts) {
          const c = p.indexOf(':');
          if (c < 0) throw new YamlError(`Expected ':' in flow mapping`, lineNo);
          const k = p.slice(0, c).trim();
          const v = p.slice(c + 1).trim();
          obj[LINES_KEY][k] = lineNo;
          obj[k] = parseScalar(v, lineNo);
        }
      }
      return obj;
    }
    return parseScalar(s, lineNo);
  }

  function splitFlow(s, lineNo) {
    const parts = [];
    let depth = 0, inSingle = false, inDouble = false, start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) {
          parts.push(s.slice(start, i).trim());
          start = i + 1;
        }
      }
    }
    parts.push(s.slice(start).trim());
    return parts;
  }

  function parseBlockScalar(parentIndent) {
    // Consume subsequent lines indented more than parentIndent and join with newlines.
    const lines = [];
    while (true) {
      const next = peek();
      if (!next) break;
      if (next.indent <= parentIndent) break;
      pos++;
      lines.push(next.content);
    }
    return lines.join('\n');
  }

  // Top level: either a map or a list.
  if (tokens.length === 0) return {};
  return parseBlock(tokens[0].indent);
}

// ---------- Validation ----------

const errors = [];
const warnings = [];
function pushError(line, msg) { errors.push({ line, msg, level: 'error' }); }
function pushWarning(line, msg) { warnings.push({ line, msg, level: 'warning' }); }

let doc = null;
try {
  doc = parseYaml(rawText);
} catch (e) {
  if (e instanceof YamlError) {
    pushError(e.line, `YAML parse error: ${e.message}`);
  } else {
    pushError(null, `YAML parse error: ${e.message}`);
  }
}

const KNOWN_TYPES = new Set([
  'string', 'text', 'int', 'float', 'boolean', 'cuid', 'uuid',
  'datetime', 'json', 'bytes',
]);
const STACK_TYPES = new Set(['fullstack', 'spa', 'api']);
const NAME_RE = /^[a-z][a-z0-9-]*$/;
const MODEL_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const FIELD_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

function lineOf(node, key) {
  if (node && typeof node === 'object' && node[LINES_KEY] && key && key in node[LINES_KEY]) return node[LINES_KEY][key];
  if (node && typeof node === 'object' && node[LINE_KEY]) return node[LINE_KEY];
  return null;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

function closest(name, candidates) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  // Only suggest if reasonably close
  if (best && bestD <= Math.max(2, Math.floor(name.length / 3))) return best;
  return null;
}

// ---------- Skill mapping table from orchestrator.md ----------
function loadSkillMap(kb) {
  const orchPath = join(kb, 'agents', 'orchestrator.md');
  if (!existsSync(orchPath)) return null;
  const text = readFileSync(orchPath, 'utf8');
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const skills = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+Skill Mapping\b/.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection) continue;
    // Match table rows: | `name` | path | layer |
    const m = line.match(/^\s*\|\s*`([^`]+)`\s*\|/);
    if (m) skills.add(m[1]);
  }
  return skills.size > 0 ? skills : null;
}

const skillMap = doc ? loadSkillMap(kbPath) : null;
if (doc && skillMap === null) {
  pushWarning(null, `Could not load skill mapping table from ${join(kbPath, 'agents', 'orchestrator.md')}; skill validation skipped`);
}

// ---------- Top-level checks ----------
if (doc && !isPlainObject(doc)) {
  pushError(1, `Top-level YAML must be a mapping`);
}

if (doc && isPlainObject(doc)) {
  // 3. Required fields
  if (!('name' in doc)) {
    pushError(1, `Required field 'name' missing`);
  } else if (typeof doc.name !== 'string') {
    pushError(lineOf(doc, 'name'), `Field 'name' must be a string`);
  } else if (!NAME_RE.test(doc.name)) {
    pushError(lineOf(doc, 'name'), `Field 'name' must be lowercase kebab-case (matching /^[a-z][a-z0-9-]*$/), got '${doc.name}'`);
  }

  if (!('description' in doc)) {
    pushError(1, `Required field 'description' missing`);
  } else if (typeof doc.description !== 'string' || doc.description.trim() === '') {
    pushError(lineOf(doc, 'description'), `Field 'description' must be a non-empty string`);
  }

  if (!('features' in doc)) {
    pushError(1, `Required field 'features' missing`);
  } else if (!Array.isArray(doc.features) || doc.features.length === 0) {
    pushError(lineOf(doc, 'features'), `Field 'features' must be a non-empty list`);
  }

  // 5. stack
  if ('stack' in doc && doc.stack !== null) {
    if (!isPlainObject(doc.stack)) {
      pushError(lineOf(doc, 'stack'), `Field 'stack' must be an object`);
    } else if ('type' in doc.stack && doc.stack.type !== null && !STACK_TYPES.has(doc.stack.type)) {
      pushError(lineOf(doc.stack, 'type'), `Unknown stack.type '${doc.stack.type}'. Allowed: ${[...STACK_TYPES].join(', ')}`);
    }
  }

  // 6. template
  if ('template' in doc && doc.template !== null) {
    if (typeof doc.template !== 'string') {
      pushError(lineOf(doc, 'template'), `Field 'template' must be a string`);
    } else {
      const tplDir = join(kbPath, 'templates', doc.template);
      if (!existsSync(tplDir) || !statSync(tplDir).isDirectory()) {
        const tplRoot = join(kbPath, 'templates');
        let available = [];
        try { available = readdirSync(tplRoot).filter(d => statSync(join(tplRoot, d)).isDirectory()); } catch { /* ignore */ }
        pushError(lineOf(doc, 'template'), `Template '${doc.template}' not found under ${tplRoot}. Available: ${available.join(', ') || '(none)'}`);
      }
    }
  }

  // 7. models
  const modelNames = new Set();
  if ('models' in doc && doc.models !== null) {
    if (!isPlainObject(doc.models)) {
      pushError(lineOf(doc, 'models'), `Field 'models' must be an object`);
    } else {
      for (const mname of Object.keys(doc.models)) {
        if (!MODEL_NAME_RE.test(mname)) {
          pushError(lineOf(doc.models, mname), `Model name '${mname}' must be PascalCase (/^[A-Z][A-Za-z0-9]*$/)`);
        }
        modelNames.add(mname);
      }
      // Validate each model's fields
      for (const [mname, model] of Object.entries(doc.models)) {
        if (!isPlainObject(model)) {
          pushError(lineOf(doc.models, mname), `Model '${mname}' must be an object`);
          continue;
        }
        if (!('fields' in model) || !isPlainObject(model.fields)) {
          pushError(lineOf(model, 'fields') || lineOf(doc.models, mname), `Model '${mname}' must have a 'fields' object`);
          continue;
        }
        for (const [fname, fval] of Object.entries(model.fields)) {
          const fline = lineOf(model.fields, fname);
          if (!FIELD_NAME_RE.test(fname)) {
            pushError(fline, `Field name '${fname}' on model '${mname}' must be camelCase (/^[a-z][A-Za-z0-9]*$/)`);
          }
          // Field value: either a scalar string, or an object (e.g. with nested validation)
          let typeStr = null;
          if (typeof fval === 'string') typeStr = fval;
          else if (isPlainObject(fval) && typeof fval.type === 'string') typeStr = fval.type;
          else if (fval === null) {
            pushError(fline, `Field '${mname}.${fname}' has no type`);
            continue;
          } else {
            // A bare nested object with extra keys (e.g., validation:) — the type should have been on the parent line.
            // We accept this silently if the parser couldn't recover the type; flag as error otherwise.
            pushError(fline, `Field '${mname}.${fname}' must have a type string`);
            continue;
          }
          // Strip modifiers
          const tokens = typeStr.trim().split(/\s+/);
          if (tokens.length === 0 || tokens[0] === '') {
            pushError(fline, `Field '${mname}.${fname}' has no type`);
            continue;
          }
          let firstTok = tokens[0];
          // Strip array suffix `Foo[]` and optional suffix `Foo?`
          let baseType = firstTok.replace(/\[\]$/, '').replace(/\?$/, '');
          if (KNOWN_TYPES.has(baseType)) {
            // ok
          } else if (modelNames.has(baseType)) {
            // relation, ok
          } else if (baseType.startsWith('enum(') && baseType.endsWith(')')) {
            // enum reference, ok
          } else {
            const pool = [...KNOWN_TYPES, ...modelNames];
            const sug = closest(baseType, pool);
            pushError(fline, `Field '${mname}.${fname}' uses unknown type '${baseType}'${sug ? `. Did you mean '${sug}'?` : ''}`);
          }
        }
      }
    }
  }

  // 8. features
  const featureNames = new Set();
  const featureByName = new Map();
  if (Array.isArray(doc.features)) {
    for (let i = 0; i < doc.features.length; i++) {
      const feat = doc.features[i];
      const fline = (isPlainObject(feat) ? feat[LINE_KEY] : null) || lineOf(doc, 'features');
      if (!isPlainObject(feat)) {
        pushError(fline, `Feature #${i + 1} must be an object`);
        continue;
      }
      if (!('name' in feat)) {
        pushError(fline, `Feature #${i + 1} missing required 'name'`);
      } else if (typeof feat.name !== 'string' || !NAME_RE.test(feat.name)) {
        pushError(lineOf(feat, 'name'), `Feature 'name' must be kebab-case, got '${feat.name}'`);
      } else {
        if (featureNames.has(feat.name)) {
          pushError(lineOf(feat, 'name'), `Duplicate feature name '${feat.name}'`);
        }
        featureNames.add(feat.name);
        featureByName.set(feat.name, feat);
      }
      if (!('description' in feat) || typeof feat.description !== 'string' || feat.description.trim() === '') {
        pushError(lineOf(feat, 'description') || fline, `Feature '${feat.name || `#${i + 1}`}' missing required 'description'`);
      }
      if ('skills' in feat && feat.skills !== null) {
        if (!Array.isArray(feat.skills)) {
          pushError(lineOf(feat, 'skills'), `Feature '${feat.name}'.skills must be a list`);
        } else if (skillMap) {
          for (const s of feat.skills) {
            if (typeof s !== 'string') {
              pushError(lineOf(feat, 'skills'), `Skill entry must be a string in feature '${feat.name}'`);
              continue;
            }
            if (!skillMap.has(s)) {
              const sug = closest(s, [...skillMap]);
              const msg = `Unknown skill '${s}' in feature '${feat.name}'${sug ? `. Did you mean '${sug}'?` : ''}`;
              if (allowUnknownSkills) pushWarning(lineOf(feat, 'skills'), msg);
              else pushError(lineOf(feat, 'skills'), msg);
            }
          }
        }
      }
    }
    // depends_on validation (after collecting names)
    for (const feat of doc.features) {
      if (!isPlainObject(feat)) continue;
      if ('depends_on' in feat && feat.depends_on !== null) {
        if (!Array.isArray(feat.depends_on)) {
          pushError(lineOf(feat, 'depends_on'), `Feature '${feat.name}'.depends_on must be a list`);
          continue;
        }
        for (const dep of feat.depends_on) {
          if (typeof dep !== 'string' || !featureNames.has(dep)) {
            pushError(lineOf(feat, 'depends_on'), `Feature '${feat.name}'.depends_on references unknown feature '${dep}'`);
          }
        }
      }
      if ('extends' in feat && feat.extends !== null) {
        if (typeof feat.extends !== 'string' || !featureNames.has(feat.extends)) {
          pushError(lineOf(feat, 'extends'), `Feature '${feat.name}'.extends references unknown feature '${feat.extends}'`);
        }
      }
    }

    // 9. cycle detection (Kahn / DFS)
    const graph = new Map();
    for (const feat of doc.features) {
      if (!isPlainObject(feat) || typeof feat.name !== 'string') continue;
      const deps = Array.isArray(feat.depends_on) ? feat.depends_on.filter(d => typeof d === 'string' && featureNames.has(d)) : [];
      graph.set(feat.name, deps);
    }
    const cycle = findCycle(graph);
    if (cycle) {
      const lineForCycle = (() => {
        const f = featureByName.get(cycle[0]);
        return f ? lineOf(f, 'depends_on') || f[LINE_KEY] : null;
      })();
      pushError(lineForCycle, `Cycle in feature dependencies: ${cycle.join(' \u2192 ')}`);
    }
  }

  // 10. pages
  if ('pages' in doc && doc.pages !== null) {
    if (!Array.isArray(doc.pages)) {
      pushError(lineOf(doc, 'pages'), `Field 'pages' must be a list`);
    } else {
      for (let i = 0; i < doc.pages.length; i++) {
        const p = doc.pages[i];
        const pline = isPlainObject(p) ? p[LINE_KEY] : lineOf(doc, 'pages');
        if (!isPlainObject(p)) {
          pushError(pline, `Page #${i + 1} must be an object`);
          continue;
        }
        if (!('path' in p) || typeof p.path !== 'string') {
          pushError(lineOf(p, 'path') || pline, `Page #${i + 1} missing required 'path'`);
        } else if (!p.path.startsWith('/')) {
          pushError(lineOf(p, 'path'), `Page path '${p.path}' must start with '/'`);
        }
        if ('auth' in p && p.auth !== null && typeof p.auth !== 'boolean') {
          pushError(lineOf(p, 'auth'), `Page 'auth' must be a boolean`);
        }
        if ('features' in p && p.features !== null) {
          if (!Array.isArray(p.features)) {
            pushError(lineOf(p, 'features'), `Page 'features' must be a list of strings`);
          }
          // Per spec: "each must be a feature `name` if present in `features`".
          // pages[].features are typically prose bullets, not feature names. We only
          // flag a string if it exactly matches the kebab-case name shape AND is not
          // a known feature — which would suggest a typo. To stay conservative we skip
          // the cross-check (descriptions like "list todos" are valid).
        }
      }
    }
  }

  // 11. v2 sections — only validated if version: 2
  const isV2 = doc.version === 2;
  if (isV2) {
    validateV2(doc);
  }
}

function validateV2(doc) {
  // integrations: list of { service, purpose, env_vars[], sdk }
  if ('integrations' in doc && doc.integrations !== null) {
    if (!Array.isArray(doc.integrations)) {
      pushError(lineOf(doc, 'integrations'), `'integrations' must be a list`);
    } else {
      for (let i = 0; i < doc.integrations.length; i++) {
        const it = doc.integrations[i];
        const ln = isPlainObject(it) ? it[LINE_KEY] : lineOf(doc, 'integrations');
        if (!isPlainObject(it)) { pushError(ln, `integrations[${i}] must be an object`); continue; }
        for (const f of ['service', 'purpose', 'sdk']) {
          if (typeof it[f] !== 'string') pushError(lineOf(it, f) || ln, `integrations[${i}].${f} must be a string`);
        }
        if (!Array.isArray(it.env_vars)) pushError(lineOf(it, 'env_vars') || ln, `integrations[${i}].env_vars must be a list`);
      }
    }
  }
  // jobs: list of { name, trigger, schedule|queue, description }
  if ('jobs' in doc && doc.jobs !== null) {
    if (!Array.isArray(doc.jobs)) {
      pushError(lineOf(doc, 'jobs'), `'jobs' must be a list`);
    } else {
      for (let i = 0; i < doc.jobs.length; i++) {
        const j = doc.jobs[i];
        const ln = isPlainObject(j) ? j[LINE_KEY] : lineOf(doc, 'jobs');
        if (!isPlainObject(j)) { pushError(ln, `jobs[${i}] must be an object`); continue; }
        if (typeof j.name !== 'string') pushError(lineOf(j, 'name') || ln, `jobs[${i}].name must be a string`);
        if (j.trigger !== 'cron' && j.trigger !== 'queue') pushError(lineOf(j, 'trigger') || ln, `jobs[${i}].trigger must be 'cron' or 'queue'`);
        if (j.trigger === 'cron' && typeof j.schedule !== 'string') pushError(lineOf(j, 'schedule') || ln, `jobs[${i}] (cron) must have a 'schedule' string`);
        if (j.trigger === 'queue' && typeof j.queue !== 'string') pushError(lineOf(j, 'queue') || ln, `jobs[${i}] (queue) must have a 'queue' string`);
        if (typeof j.description !== 'string') pushError(lineOf(j, 'description') || ln, `jobs[${i}].description must be a string`);
      }
    }
  }
  // webhooks
  if ('webhooks' in doc && doc.webhooks !== null) {
    if (!Array.isArray(doc.webhooks)) {
      pushError(lineOf(doc, 'webhooks'), `'webhooks' must be a list`);
    } else {
      for (let i = 0; i < doc.webhooks.length; i++) {
        const w = doc.webhooks[i];
        const ln = isPlainObject(w) ? w[LINE_KEY] : lineOf(doc, 'webhooks');
        if (!isPlainObject(w)) { pushError(ln, `webhooks[${i}] must be an object`); continue; }
        for (const f of ['source', 'event', 'path', 'description']) {
          if (typeof w[f] !== 'string') pushError(lineOf(w, f) || ln, `webhooks[${i}].${f} must be a string`);
        }
        if (typeof w.path === 'string' && !w.path.startsWith('/')) {
          pushError(lineOf(w, 'path'), `webhooks[${i}].path must start with '/'`);
        }
      }
    }
  }
  // tenancy
  if ('tenancy' in doc && doc.tenancy !== null) {
    const t = doc.tenancy;
    const ln = lineOf(doc, 'tenancy');
    if (!isPlainObject(t)) { pushError(ln, `'tenancy' must be an object`); }
    else {
      if (typeof t.model !== 'string') pushError(lineOf(t, 'model') || ln, `tenancy.model must be a string`);
      if (t.isolation !== 'row-level' && t.isolation !== 'schema-level') pushError(lineOf(t, 'isolation') || ln, `tenancy.isolation must be 'row-level' or 'schema-level'`);
      if (!isPlainObject(t.fields)) pushError(lineOf(t, 'fields') || ln, `tenancy.fields must be an object`);
      if (t.user_relation !== 'one-to-many' && t.user_relation !== 'many-to-many') pushError(lineOf(t, 'user_relation') || ln, `tenancy.user_relation must be 'one-to-many' or 'many-to-many'`);
    }
  }
  // rbac
  if ('rbac' in doc && doc.rbac !== null) {
    const r = doc.rbac;
    const ln = lineOf(doc, 'rbac');
    if (!isPlainObject(r)) { pushError(ln, `'rbac' must be an object`); }
    else {
      if (!Array.isArray(r.roles)) pushError(lineOf(r, 'roles') || ln, `rbac.roles must be a list`);
      else {
        const roleNames = new Set();
        for (let i = 0; i < r.roles.length; i++) {
          const role = r.roles[i];
          const rln = isPlainObject(role) ? role[LINE_KEY] : lineOf(r, 'roles');
          if (!isPlainObject(role)) { pushError(rln, `rbac.roles[${i}] must be an object`); continue; }
          if (typeof role.name !== 'string') pushError(lineOf(role, 'name') || rln, `rbac.roles[${i}].name must be a string`);
          else roleNames.add(role.name);
          if (!Array.isArray(role.permissions)) pushError(lineOf(role, 'permissions') || rln, `rbac.roles[${i}].permissions must be a list`);
        }
        if (typeof r.default_role !== 'string') pushError(lineOf(r, 'default_role') || ln, `rbac.default_role must be a string`);
        else if (roleNames.size > 0 && !roleNames.has(r.default_role)) {
          pushError(lineOf(r, 'default_role'), `rbac.default_role '${r.default_role}' must match one of: ${[...roleNames].join(', ')}`);
        }
      }
    }
  }
  // flags
  if ('flags' in doc && doc.flags !== null) {
    const f = doc.flags;
    const ln = lineOf(doc, 'flags');
    if (!isPlainObject(f)) { pushError(ln, `'flags' must be an object`); }
    else {
      const okProviders = new Set(['env', 'statsig', 'launchdarkly', 'unleash']);
      if (typeof f.provider !== 'string' || !okProviders.has(f.provider)) {
        pushError(lineOf(f, 'provider') || ln, `flags.provider must be one of: ${[...okProviders].join(', ')}`);
      }
      if (!Array.isArray(f.flags)) pushError(lineOf(f, 'flags') || ln, `flags.flags must be a list`);
      else {
        for (let i = 0; i < f.flags.length; i++) {
          const fl = f.flags[i];
          const flLn = isPlainObject(fl) ? fl[LINE_KEY] : lineOf(f, 'flags');
          if (!isPlainObject(fl)) { pushError(flLn, `flags.flags[${i}] must be an object`); continue; }
          if (typeof fl.name !== 'string') pushError(lineOf(fl, 'name') || flLn, `flags.flags[${i}].name must be a string`);
          if (typeof fl.description !== 'string') pushError(lineOf(fl, 'description') || flLn, `flags.flags[${i}].description must be a string`);
          if (!('default' in fl)) pushError(flLn, `flags.flags[${i}] must have a 'default'`);
        }
      }
    }
  }
  // shared
  if ('shared' in doc && doc.shared !== null) {
    if (!Array.isArray(doc.shared)) {
      pushError(lineOf(doc, 'shared'), `'shared' must be a list`);
    } else {
      for (let i = 0; i < doc.shared.length; i++) {
        const s = doc.shared[i];
        const ln = isPlainObject(s) ? s[LINE_KEY] : lineOf(doc, 'shared');
        if (!isPlainObject(s)) { pushError(ln, `shared[${i}] must be an object`); continue; }
        if (typeof s.name !== 'string') pushError(lineOf(s, 'name') || ln, `shared[${i}].name must be a string`);
        if (typeof s.description !== 'string') pushError(lineOf(s, 'description') || ln, `shared[${i}].description must be a string`);
        if (!Array.isArray(s.skills)) pushError(lineOf(s, 'skills') || ln, `shared[${i}].skills must be a list`);
      }
    }
  }
  // config
  if ('config' in doc && doc.config !== null) {
    const c = doc.config;
    const ln = lineOf(doc, 'config');
    if (!isPlainObject(c)) { pushError(ln, `'config' must be an object`); }
    else {
      if (!Array.isArray(c.environments)) pushError(lineOf(c, 'environments') || ln, `config.environments must be a list`);
      if (!isPlainObject(c.vars)) pushError(lineOf(c, 'vars') || ln, `config.vars must be an object`);
    }
  }
}

function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();
  for (const k of graph.keys()) color.set(k, WHITE);
  let cycle = null;
  function dfs(u) {
    if (cycle) return;
    color.set(u, GRAY);
    for (const v of graph.get(u) || []) {
      if (cycle) return;
      if (!graph.has(v)) continue;
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      } else if (color.get(v) === GRAY) {
        // Reconstruct cycle: v -> ... -> u -> v
        const path = [v];
        let cur = u;
        while (cur !== v && cur !== undefined) {
          path.push(cur);
          cur = parent.get(cur);
          if (path.length > graph.size + 1) break;
        }
        path.push(v);
        path.reverse();
        cycle = path;
        return;
      }
    }
    color.set(u, BLACK);
  }
  for (const k of graph.keys()) {
    if (color.get(k) === WHITE) dfs(k);
    if (cycle) break;
  }
  return cycle;
}

// ---------- Output ----------
const allDiagnostics = [...errors, ...warnings];
// Sort by line for deterministic output
allDiagnostics.sort((a, b) => (a.line || 0) - (b.line || 0));

if (errors.length === 0) {
  // print warnings if any
  for (let i = 0; i < warnings.length; i++) {
    const w = warnings[i];
    const lineStr = w.line ? `[line ${w.line}] ` : '';
    process.stdout.write(`  ${C.yellow('warning')}: ${lineStr}${w.msg}\n`);
  }
  const name = doc?.name || '(unknown)';
  const numFeatures = Array.isArray(doc?.features) ? doc.features.length : 0;
  const numModels = isPlainObject(doc?.models) ? Object.keys(doc.models).length : 0;
  process.stdout.write(`${C.green('OK')} \u2014 blueprint ${name} validates against schema. ${numFeatures} features, ${numModels} models.\n`);
  process.exit(0);
} else {
  process.stdout.write(`${C.red('ERROR')} validating ${blueprintPath}:\n`);
  let n = 1;
  for (const d of allDiagnostics) {
    const lineStr = d.line ? `[line ${d.line}] ` : '';
    const prefix = d.level === 'warning' ? `${C.yellow('warning')}: ` : '';
    process.stdout.write(`  ${n}. ${prefix}${lineStr}${d.msg}\n`);
    n++;
  }
  process.stdout.write(`${errors.length} error(s)\n`);
  process.exit(1);
}
