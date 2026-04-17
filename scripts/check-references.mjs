#!/usr/bin/env node
// Reference linter for the claude-app-orchestrator knowledge base.
// Pure Node ESM, zero npm dependencies. Exit code 0 on success, non-zero on failures.
//
// Checks performed:
//   1. Skill mapping completeness (table in agents/orchestrator.md ↔ files under skills/).
//   2. Agent skill references (paths and short names mentioned in agents/*.md).
//   3. Agent-to-agent references (agents/*.md paths and "X Builder (`agents/foo.md`)").
//   4. Template references in agents/orchestrator.md and agents/project-initializer.md.
//   5. Blueprint feature → skill resolution (blueprints/examples/*.yaml,
//      examples/built/*/blueprint.yaml).
//   6. Orphaned skill files (skills under skills/ neither mapped nor referenced).

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..'); // scripts/.. = repo root

// ---------- ANSI colors ----------
const useColor = process.stdout.isTTY;
const C = {
  red: (s) => useColor ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: (s) => useColor ? `\x1b[33m${s}\x1b[0m` : s,
  green: (s) => useColor ? `\x1b[32m${s}\x1b[0m` : s,
  cyan: (s) => useColor ? `\x1b[36m${s}\x1b[0m` : s,
  dim: (s) => useColor ? `\x1b[2m${s}\x1b[0m` : s,
  bold: (s) => useColor ? `\x1b[1m${s}\x1b[0m` : s,
};

const errors = [];
const warnings = [];
function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

// ---------- Utilities ----------
function rel(p) { return relative(repoRoot, p) || p; }

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

function closest(name, candidates, threshold = 3) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best && bestD <= threshold) return best;
  return null;
}

function walk(dir, filter = () => true, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

// ---------- Load skill mapping ----------
function loadSkillMapping() {
  const orchPath = join(repoRoot, 'agents', 'orchestrator.md');
  if (!existsSync(orchPath)) {
    err(`agents/orchestrator.md not found — cannot load skill mapping`);
    return { skills: new Map(), tableLines: 0 };
  }
  const text = readFileSync(orchPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const skills = new Map(); // shortName -> { path, line, layer }
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+Skill Mapping\b/.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection) continue;
    // | `name` | `path` | layer |   (path may be backticked or bare)
    const m = line.match(/^\s*\|\s*`([^`]+)`\s*\|\s*`?([^`|]+?)`?\s*\|\s*([^|]+?)\s*\|/);
    if (m) {
      const shortName = m[1];
      const path = m[2].trim();
      const layer = m[3].trim();
      skills.set(shortName, { path, line: i + 1, layer });
    }
  }
  return { skills, tableLines: skills.size };
}

// ---------- Check 1: Skill mapping completeness ----------
function checkSkillMapping(mapping) {
  process.stdout.write(`  ${C.dim('-')} skill mapping: `);
  const allSkillFiles = walk(join(repoRoot, 'skills'),
    (p) => p.endsWith('.md') && !p.endsWith('README.md'));
  const allSkillRel = new Set(allSkillFiles.map(p => rel(p)));

  // Verify every mapping path exists.
  let pathsOk = 0;
  for (const [name, info] of mapping.skills) {
    const abs = join(repoRoot, info.path);
    if (existsSync(abs) && statSync(abs).isFile()) {
      pathsOk++;
    } else {
      err(`agents/orchestrator.md:${info.line} skill mapping '${name}' references missing file ${info.path}`);
    }
  }

  // Verify every skill file has a mapping row.
  const mappedPaths = new Set([...mapping.skills.values()].map(v => v.path));
  let mappedCount = 0;
  for (const skillRel of allSkillRel) {
    if (mappedPaths.has(skillRel)) {
      mappedCount++;
    }
    // Missing-mapping side is the orphaned-skills check below.
  }

  const total = mapping.skills.size;
  const pathStatus = pathsOk === total ? C.green('✓') : C.red('✗');
  const mapStatus = mappedCount === allSkillRel.size ? C.green('✓') : '';
  process.stdout.write(
    `${pathsOk}/${total} paths exist; ${mappedCount} skills mapped of ${allSkillRel.size} found ${pathStatus} ${mapStatus}\n`
  );

  return { allSkillRel, mappedPaths };
}

// ---------- Check 2 & 3: Agent skill refs and agent-to-agent refs ----------
function checkAgentReferences(mapping) {
  const agentsDir = join(repoRoot, 'agents');
  const agentFiles = walk(agentsDir, (p) => p.endsWith('.md') && !p.endsWith('README.md'));
  process.stdout.write(`  ${C.dim('-')} agent skill refs: scanning ${agentFiles.length} agents...\n`);

  const skillNames = [...mapping.skills.keys()];
  const skillNameSet = new Set(skillNames);

  for (const agentPath of agentFiles) {
    const text = readFileSync(agentPath, 'utf8');
    const lines = text.split(/\r?\n/);
    const relAgent = rel(agentPath);

    // 2a. Path-based skill references like `skills/frontend/foo.md`
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const re = /skills\/[a-z0-9_-]+\/[a-z0-9_-]+\.md/gi;
      let m;
      while ((m = re.exec(line)) !== null) {
        const ref = m[0];
        const abs = join(repoRoot, ref);
        if (!existsSync(abs)) {
          err(`${relAgent}:${i + 1} references missing skill file ${ref}`);
        }
      }
    }

    // 2b. Short-name skill refs near "Skills to load" / "Skills loaded" / "load these skills"
    // Strategy: find anchor lines, then within a bounded window (next 30 lines or
    // until next section heading), collect backticked short names and verify them.
    const anchorRe = /skills to load|skills loaded|load (?:these |the relevant |relevant )?skills/i;
    for (let i = 0; i < lines.length; i++) {
      if (!anchorRe.test(lines[i])) continue;
      const start = i;
      let end = Math.min(lines.length, i + 30);
      for (let j = i + 1; j < end; j++) {
        if (/^#{1,6}\s/.test(lines[j])) { end = j; break; }
      }
      const seen = new Set();
      for (let j = start; j < end; j++) {
        const lineText = lines[j];
        // Strip path-style refs first so we don't double-flag the file basename
        const cleaned = lineText.replace(/skills\/[a-z0-9_-]+\/[a-z0-9_-]+\.md/gi, '');
        const tickRe = /`([a-z0-9][a-z0-9_-]+)`/gi;
        let m;
        while ((m = tickRe.exec(cleaned)) !== null) {
          const name = m[1];
          // Ignore obvious non-skill backticks: file paths, code, function calls
          if (name.includes('/') || name.includes('.') || name.includes('(')) continue;
          if (seen.has(name)) continue;
          seen.add(name);
          // Skip keywords commonly seen near these anchors
          const stopwords = new Set([
            'use', 'and', 'or', 'the', 'a', 'an', 'of', 'plus',
            'src', 'tsx', 'ts', 'js', 'as', 'also', 'always', 'optional',
            'rest-zod', 'trpc-client', 'graphql-sdl', 'server-actions',
          ]);
          if (stopwords.has(name)) continue;
          // Only check candidates that look like a skill short-name
          // (lowercase, one or more hyphens or matches known skill style).
          if (!/^[a-z][a-z0-9-]*$/.test(name)) continue;
          if (!skillNameSet.has(name)) {
            // Heuristic: only flag if the name looks plausibly intended as a skill
            // (i.e., shares the style of known skills). Suggest closest if reasonable.
            const sug = closest(name, skillNames, 3);
            if (sug) {
              err(`${relAgent}:${j + 1} references unknown skill '${name}' — did you mean '${sug}'?`);
            }
            // If no close match, it's probably not a skill reference at all (could
            // be a package name, a file basename, etc.). Skip silently.
          }
        }
      }
    }
  }

  // ---------- Check 3: Agent-to-agent references ----------
  process.stdout.write(`  ${C.dim('-')} agent-to-agent refs: scanning ${agentFiles.length} agents...\n`);
  for (const agentPath of agentFiles) {
    const text = readFileSync(agentPath, 'utf8');
    const lines = text.split(/\r?\n/);
    const relAgent = rel(agentPath);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const re = /agents\/[a-z0-9_-]+\.md/gi;
      let m;
      while ((m = re.exec(line)) !== null) {
        const ref = m[0];
        const abs = join(repoRoot, ref);
        if (!existsSync(abs)) {
          err(`${relAgent}:${i + 1} references ${ref} (file not found)`);
        }
      }
    }
  }

  return agentFiles;
}

// ---------- Check 4: Template references ----------
function checkTemplateReferences() {
  const sources = [
    join(repoRoot, 'agents', 'orchestrator.md'),
    join(repoRoot, 'agents', 'project-initializer.md'),
  ];
  // Real templates on disk.
  const tplRoot = join(repoRoot, 'templates');
  const realTemplates = new Set();
  if (existsSync(tplRoot)) {
    for (const ent of readdirSync(tplRoot)) {
      const p = join(tplRoot, ent);
      if (statSync(p).isDirectory()) realTemplates.add(ent);
    }
  }

  const referenced = new Set();
  for (const src of sources) {
    if (!existsSync(src)) continue;
    const text = readFileSync(src, 'utf8');
    const lines = text.split(/\r?\n/);
    // Track whether we're inside a "Template Resolution" / "Template" section
    // so we can extract bare backticked template names with low false-positives.
    let inTplSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,6}\s+/.test(line)) {
        inTplSection = /template/i.test(line);
      }
      // Form A: `templates/{name}/` path-like reference.
      const re = /templates\/([a-z0-9_-]+)(?=[\/`\s)\]]|$)/gi;
      let m;
      while ((m = re.exec(line)) !== null) {
        const name = m[1];
        // Skip literal placeholders used in path templates
        if (name === 'name' || name === 'template' || name === 'template_name') continue;
        referenced.add(name);
        if (!realTemplates.has(name)) {
          err(`${rel(src)}:${i + 1} references missing template templates/${name}/`);
        }
      }
      // Form B: bare backticked template names (e.g. in the resolution table).
      // Trigger when the line itself mentions template/stack/scaffold OR when we
      // are inside a heading section about templates.
      const lineMentionsTemplate = /template|stack\.type|scaffold/i.test(line);
      if (lineMentionsTemplate || inTplSection) {
        const bareRe = /`([a-z0-9]+(?:-[a-z0-9]+)+)`/g;
        let bm;
        while ((bm = bareRe.exec(line)) !== null) {
          const name = bm[1];
          // Heuristic: a template name is a known template OR a hyphenated name
          // starting with a recognized framework prefix.
          const looksLikeTemplate = realTemplates.has(name)
            || /^(nextjs|vite|hono|react|next|remix|sveltekit|astro|express|koa|nest)-/.test(name);
          if (!looksLikeTemplate) continue;
          referenced.add(name);
          if (!realTemplates.has(name)) {
            err(`${rel(src)}:${i + 1} references missing template '${name}'`);
          }
        }
      }
    }
  }

  const realCount = realTemplates.size;
  const refCount = [...referenced].filter(n => realTemplates.has(n)).length;
  const status = refCount === referenced.size ? C.green('✓') : C.red('✗');
  process.stdout.write(`  ${C.dim('-')} template refs: ${refCount}/${referenced.size} referenced templates exist (${realCount} on disk) ${status}\n`);
}

// ---------- Check 5: Blueprint feature → skill resolution ----------
//
// Minimal "skills:" extractor. We don't need the full YAML parser — only the
// inline list values for `skills:` keys appearing inside `features:` lists. To
// keep false positives low, we also extract `shared[].skills` and `jobs[].skills`
// (same shape, also referenced by orchestrator agents).
function extractSkillsLists(text) {
  // Returns array of { skills: [name], line }.
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match `    skills: [a, b, c]` (any indent). Strip inline comments first.
    let stripped = line;
    // Remove `# ...` comments outside brackets — simplest: replace after the closing `]`.
    const skillsRe = /^\s*skills\s*:\s*\[([^\]]*)\]\s*(?:#.*)?$/;
    const mm = stripped.match(skillsRe);
    if (mm) {
      const inner = mm[1];
      const names = inner.split(',').map(s => s.trim()).filter(Boolean);
      out.push({ skills: names, line: i + 1 });
      continue;
    }
    // Also handle multi-line skills lists (less common in our blueprints):
    //   skills:
    //     - foo
    //     - bar
    const headerRe = /^(\s*)skills\s*:\s*$/;
    const hm = stripped.match(headerRe);
    if (hm) {
      const baseIndent = hm[1].length;
      const names = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        const nm = next.match(/^(\s*)-\s*([a-z0-9_-]+)\s*(?:#.*)?$/);
        if (!nm) break;
        if (nm[1].length <= baseIndent) break;
        names.push(nm[2]);
        j++;
      }
      if (names.length > 0) out.push({ skills: names, line: i + 1 });
    }
  }
  return out;
}

function checkBlueprintSkills(mapping) {
  const blueprintFiles = [
    ...walk(join(repoRoot, 'blueprints', 'examples'), p => p.endsWith('.yaml')),
    ...walk(join(repoRoot, 'examples', 'built'),
      p => p.endsWith('blueprint.yaml')),
  ];
  process.stdout.write(`  ${C.dim('-')} blueprint skill refs: scanning ${blueprintFiles.length} blueprints...`);
  let okCount = 0;
  let issueCount = 0;
  const skillNames = [...mapping.skills.keys()];

  for (const bp of blueprintFiles) {
    const text = readFileSync(bp, 'utf8');
    const lists = extractSkillsLists(text);
    let bpOk = true;
    for (const { skills, line } of lists) {
      for (const name of skills) {
        if (!mapping.skills.has(name)) {
          const sug = closest(name, skillNames, 3);
          err(`${rel(bp)}:${line} references unknown skill '${name}'${sug ? ` — did you mean '${sug}'?` : ''}`);
          issueCount++;
          bpOk = false;
        }
      }
    }
    if (bpOk) okCount++;
  }
  const status = issueCount === 0 ? C.green('✓') : C.red('✗');
  process.stdout.write(`  ${okCount}/${blueprintFiles.length} OK ${status}\n`);
}

// ---------- Check 6: Orphaned skill files ----------
function checkOrphanedSkills(mapping, allSkillRel, mappedPaths, agentFiles) {
  // A skill is orphaned if NOT in mapping AND not referenced by any agent file
  // (by relative path or short name).
  const referencedBy = new Map(); // skillRel -> Set of agent paths
  const skillFiles = [...allSkillRel];
  // Build set of agent texts once
  const agentTexts = agentFiles.map(p => ({ path: p, text: readFileSync(p, 'utf8') }));

  for (const skillRel of skillFiles) {
    const basename = skillRel.split('/').pop().replace(/\.md$/, '');
    let referenced = false;
    for (const { text } of agentTexts) {
      if (text.includes(skillRel)) { referenced = true; break; }
      // Also count short-name backtick mention
      const re = new RegExp('`' + basename.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '`');
      if (re.test(text)) { referenced = true; break; }
    }
    if (!referenced) referencedBy.set(skillRel, false);
    else referencedBy.set(skillRel, true);
  }

  const orphans = [];
  for (const skillRel of skillFiles) {
    if (mappedPaths.has(skillRel)) continue;
    if (!referencedBy.get(skillRel)) orphans.push(skillRel);
  }

  if (orphans.length === 0) {
    process.stdout.write(`  ${C.dim('-')} orphaned skills: none ${C.green('✓')}\n`);
  } else {
    process.stdout.write(`  ${C.dim('-')} orphaned skills:\n`);
    for (const o of orphans) {
      warn(`${o} (no mapping table entry, no agent reference)`);
      process.stdout.write(`      ${C.yellow(o)} (no mapping table entry, no agent reference)\n`);
    }
  }
}

// ---------- Output collected errors/warnings inline ----------
function reportLine(prefix, color, kind, body) {
  process.stdout.write(`    ${prefix} ${color(kind)} ${body}\n`);
}

// ---------- Main ----------
function main() {
  process.stdout.write(`${C.bold('checking references in claude-app-orchestrator...')}\n`);

  const mapping = loadSkillMapping();
  const { allSkillRel, mappedPaths } = checkSkillMapping(mapping);

  const agentFiles = checkAgentReferences(mapping);
  // Print collected errors so far (skill + agent-ref errors) inline next to their section.
  // To keep output tidy we re-print every error at the end too. Walk through new ones.

  // Print streaming errors emitted during agent ref check.
  // (They're already in `errors`. We print them once below, sorted.)

  checkTemplateReferences();
  checkBlueprintSkills(mapping);
  checkOrphanedSkills(mapping, allSkillRel, mappedPaths, agentFiles);

  // Print all errors and warnings (sorted by file/line for readability)
  if (errors.length > 0) {
    process.stdout.write(`\n${C.red('ERRORS')}\n`);
    for (const e of errors) {
      process.stdout.write(`  ${C.red('✗')} ${e}\n`);
    }
  }
  if (warnings.length > 0) {
    process.stdout.write(`\n${C.yellow('WARNINGS')}\n`);
    for (const w of warnings) {
      process.stdout.write(`  ${C.yellow('!')} ${w}\n`);
    }
  }

  process.stdout.write(`\n${errors.length} ${errors.length === 1 ? 'error' : 'errors'}, `);
  process.stdout.write(`${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}.\n`);

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
