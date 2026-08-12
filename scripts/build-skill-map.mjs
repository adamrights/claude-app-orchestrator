#!/usr/bin/env node
// Skill map generator for the claude-app-orchestrator knowledge base.
// Pure Node ESM, zero npm dependencies.
//
// Source of truth: skills/manifest.yaml
// Generated outputs:
//   1. The Skill Mapping table in agents/orchestrator.md, between
//      <!-- BEGIN GENERATED: skill-map --> and <!-- END GENERATED: skill-map -->
//   2. skills/MAP.md — browsable index grouped by category directory
//   3. skills/{category}/README.md — per-directory index (one per category)
//
// Usage:
//   node scripts/build-skill-map.mjs            # write outputs
//   node scripts/build-skill-map.mjs --check    # exit 1 if outputs drifted or manifest invalid

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const manifestPath = resolve(repoRoot, 'skills/manifest.yaml');
const orchestratorPath = resolve(repoRoot, 'agents/orchestrator.md');
const mapPath = resolve(repoRoot, 'skills/MAP.md');

const CHECK = process.argv.includes('--check');
const BEGIN = '<!-- BEGIN GENERATED: skill-map -->';
const END = '<!-- END GENERATED: skill-map -->';
const LAYERS = new Set(['frontend', 'backend', 'shared', 'devops', 'testing', 'planning']);

const errors = [];

// ---------- Minimal parser for the manifest's strict shape ----------
// Expects: a top-level `skills:` key followed by a list of flat string maps.
// Anything else is a manifest format error — strictness is the feature.
function parseManifest(text) {
  const skills = [];
  let inSkills = false;
  let current = null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) continue;
    if (/^skills:\s*$/.test(line)) { inSkills = true; continue; }
    if (!inSkills) {
      errors.push(`manifest line ${i + 1}: unexpected content before 'skills:': ${line}`);
      continue;
    }
    const itemStart = line.match(/^  - (\w[\w-]*):\s*(.+)$/);
    const field = line.match(/^    (\w[\w-]*):\s*(.+)$/);
    if (itemStart) {
      current = {};
      skills.push(current);
      current[itemStart[1]] = itemStart[2].trim();
    } else if (field && current) {
      current[field[1]] = field[2].trim();
    } else {
      errors.push(`manifest line ${i + 1}: unparseable line (expected '  - name: x' or '    field: y'): ${line}`);
    }
  }
  return skills;
}

// ---------- Validation ----------
function validate(skills) {
  const seen = new Set();
  for (const s of skills) {
    const id = s.name ?? '<missing name>';
    for (const f of ['name', 'path', 'layer', 'description', 'triggers']) {
      if (!s[f]) errors.push(`skill '${id}': missing field '${f}'`);
    }
    if (s.name) {
      if (seen.has(s.name)) errors.push(`duplicate skill name '${s.name}'`);
      seen.add(s.name);
    }
    if (s.layer && !LAYERS.has(s.layer)) {
      errors.push(`skill '${id}': unknown layer '${s.layer}' (expected one of ${[...LAYERS].join(', ')})`);
    }
    if (s.path && !existsSync(resolve(repoRoot, s.path))) {
      errors.push(`skill '${id}': path does not exist: ${s.path}`);
    }
  }

  // Every skill file on disk must have a manifest entry.
  const onDisk = walkSkillFiles(resolve(repoRoot, 'skills'));
  const mapped = new Set(skills.map((s) => s.path));
  for (const file of onDisk) {
    const relPath = relative(repoRoot, file).split(sep).join('/');
    if (!mapped.has(relPath)) errors.push(`skill file not in manifest: ${relPath}`);
  }
}

function walkSkillFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir)) {
    const p = resolve(dir, ent);
    if (statSync(p).isDirectory()) out.push(...walkSkillFiles(p));
    else if (p.endsWith('.md') && !p.endsWith('README.md') && !p.endsWith('MAP.md')) out.push(p);
  }
  return out;
}

// ---------- Generators ----------
function orchestratorTable(skills) {
  const rows = skills.map((s) => `| \`${s.name}\` | \`${s.path}\` | ${s.layer} |`);
  return [
    BEGIN,
    '<!-- Generated from skills/manifest.yaml by scripts/build-skill-map.mjs. Do not edit by hand: edit the manifest, then run `node scripts/build-skill-map.mjs`. -->',
    '',
    '| Short name | File path | Layer |',
    '|------------|-----------|-------|',
    ...rows,
    '',
    END,
  ].join('\n');
}

function mapMd(skills) {
  const byDir = new Map();
  for (const s of skills) {
    const dir = s.path.split('/')[1] ?? 'other';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(s);
  }
  const sections = [];
  for (const [dir, list] of [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sections.push(`## ${dir}`);
    sections.push('');
    sections.push('| Skill | Layer | What it covers | Load when |');
    sections.push('|-------|-------|----------------|-----------|');
    for (const s of list) {
      const link = `[\`${s.name}\`](${relative('skills', s.path).split(sep).join('/')})`;
      sections.push(`| ${link} | ${s.layer} | ${s.description} | ${s.triggers} |`);
    }
    sections.push('');
  }
  return [
    '# Skill Map',
    '',
    '<!-- Generated from skills/manifest.yaml by scripts/build-skill-map.mjs. Do not edit by hand: edit the manifest, then run `node scripts/build-skill-map.mjs`. -->',
    '',
    `${skills.length} skills. Short names are what blueprint \`skills:\` arrays and agents use; the Layer column drives the orchestrator's splittable-feature detection (only \`frontend\` and \`backend\` count toward a layer split).`,
    '',
    ...sections,
  ].join('\n');
}

const DIR_TITLES = {
  backend: 'Backend Skills',
  devops: 'DevOps Skills',
  frontend: 'Frontend Skills',
  planning: 'Planning Skills',
  testing: 'Testing Skills',
};

// One README per skills/ subdirectory, generated from the manifest.
function dirReadmes(skills) {
  const byDir = new Map();
  for (const s of skills) {
    const dir = s.path.split('/')[1] ?? 'other';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(s);
  }
  const out = new Map(); // abs path -> content
  for (const [dir, list] of byDir) {
    const title = DIR_TITLES[dir] ?? `${dir[0].toUpperCase()}${dir.slice(1)} Skills`;
    const lines = [
      `# ${title}`,
      '',
      '<!-- Generated from skills/manifest.yaml by scripts/build-skill-map.mjs. Do not edit by hand: edit the manifest, then run `make skillmap`. -->',
      '',
      '| Skill | What it covers | Load when |',
      '|-------|----------------|-----------|',
      ...list.map((s) => {
        const base = s.path.split('/').pop();
        return `| [\`${s.name}\`](${base}) | ${s.description} | ${s.triggers} |`;
      }),
      '',
      'Full cross-domain index: [../MAP.md](../MAP.md)',
      '',
    ];
    out.set(resolve(repoRoot, 'skills', dir, 'README.md'), lines.join('\n'));
  }
  return out;
}

function spliceOrchestrator(text, table) {
  const b = text.indexOf(BEGIN);
  const e = text.indexOf(END);
  if (b === -1 || e === -1) {
    errors.push(`agents/orchestrator.md: missing ${BEGIN} / ${END} markers around the Skill Mapping table`);
    return null;
  }
  return text.slice(0, b) + table + text.slice(e + END.length);
}

// ---------- Main ----------
const skills = parseManifest(readFileSync(manifestPath, 'utf8'));
validate(skills);

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const orchestratorText = readFileSync(orchestratorPath, 'utf8');
const nextOrchestrator = spliceOrchestrator(orchestratorText, orchestratorTable(skills));
const nextMap = mapMd(skills);

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const nextReadmes = dirReadmes(skills);

if (CHECK) {
  const drift = [];
  if (nextOrchestrator !== orchestratorText) drift.push('agents/orchestrator.md (Skill Mapping table)');
  if (!existsSync(mapPath) || readFileSync(mapPath, 'utf8') !== nextMap) drift.push('skills/MAP.md');
  for (const [path, content] of nextReadmes) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) drift.push(relative(repoRoot, path));
  }
  if (drift.length) {
    console.error(`error: generated skill map is stale: ${drift.join(', ')}`);
    console.error('       run: node scripts/build-skill-map.mjs');
    process.exit(1);
  }
  console.log(`skill map in sync: ${skills.length} skills, ${nextReadmes.size} directory READMEs ✓`);
} else {
  writeFileSync(orchestratorPath, nextOrchestrator);
  writeFileSync(mapPath, nextMap);
  for (const [path, content] of nextReadmes) writeFileSync(path, content);
  console.log(`wrote agents/orchestrator.md table + skills/MAP.md + ${nextReadmes.size} directory READMEs (${skills.length} skills)`);
}
