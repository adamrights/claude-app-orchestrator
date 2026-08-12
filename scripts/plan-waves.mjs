#!/usr/bin/env node
// Deterministic Phase 0 planner for the claude-app-orchestrator.
// Pure Node ESM, zero npm dependencies.
//
// THIS SCRIPT IS THE AUTHORITY on the execution-plan algorithm; the prose in
// agents/orchestrator.md defers to it. It validates the blueprint (via
// validate-blueprint.mjs --emit-json), infers dependencies between features,
// detects cycles, computes waves, applies the parallel-safety heuristics, and
// flags splittable features — emitting one JSON plan with a reason for every
// judgment call it made.
//
// Usage: node scripts/plan-waves.mjs <blueprint.yaml> [--knowledge-base <path>]
// Output (stdout): JSON — { mode, mode_reasons, dependencies, waves, splittable, warnings }
//
// Dependency rules (B depends on A when any rule fires; A precedes B in the blueprint):
//   1 explicit    — B.depends_on includes A
//   2 auth        — A is auth-ish and B references an auth:true page
//   3 model       — A and B name the same model in name/description
//   4 page        — A and B name the same page path
//   5 tests-last  — test features depend on every prior non-test feature
//   6 (schema order is subsumed by rule 3: model overlap covers shared-schema races)
//   7 touches     — declared touches globs intersect (only when both declare touches)
//
// Safety heuristics for parallel mode (execution: auto):
//   ≤ 20 features; no wave > 4; acyclic; ≥ 1 wave with 2+ features; a test feature exists.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------- args ----------
const args = process.argv.slice(2);
let blueprintArg = null;
let kbArg = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--knowledge-base') kbArg = args[++i];
  else if (a.startsWith('--')) { console.error(`unknown option: ${a}`); process.exit(2); }
  else if (!blueprintArg) blueprintArg = a;
  else { console.error(`unexpected argument: ${a}`); process.exit(2); }
}
if (!blueprintArg) {
  console.error('Usage: node scripts/plan-waves.mjs <blueprint.yaml> [--knowledge-base <path>]');
  process.exit(2);
}
const kbRoot = kbArg ? resolve(kbArg) : repoRoot;

// ---------- load blueprint via the validator (single parsing authority) ----------
const v = spawnSync('node', [resolve(kbRoot, 'scripts/validate-blueprint.mjs'), blueprintArg, '--emit-json'], { encoding: 'utf8' });
if (v.status !== 0) {
  process.stderr.write(v.stdout + v.stderr);
  console.error('plan-waves: blueprint failed validation — fix it before planning.');
  process.exit(1);
}
const bp = JSON.parse(v.stdout);

// ---------- load skill layers from the manifest ----------
function loadLayers() {
  const layers = new Map();
  const text = readFileSync(resolve(kbRoot, 'skills/manifest.yaml'), 'utf8');
  let current = null;
  for (const line of text.split('\n')) {
    const name = line.match(/^  - name: (\S+)/);
    const layer = line.match(/^    layer: (\S+)/);
    if (name) current = name[1];
    else if (layer && current) layers.set(current, layer[1]);
  }
  return layers;
}
const LAYERS = loadLayers();

// ---------- plan ----------
const features = bp.features ?? [];
const names = features.map((f) => f.name);
const nameSet = new Set(names);
const warnings = [];
const deps = new Map(names.map((n) => [n, new Map()])); // name -> Map(depName -> rule)

function addDep(b, a, rule) {
  if (a === b || !nameSet.has(a) || !nameSet.has(b)) return;
  if (!deps.get(b).has(a)) deps.get(b).set(a, rule);
}

const isTest = (f) =>
  /test/i.test(f.name) || (f.skills ?? []).some((s) => s === 'react-testing' || s === 'e2e-testing');
const isAuth = (f) => f.name === 'auth' || (f.skills ?? []).includes('authentication');
const text = (f) => `${f.name} ${f.description ?? ''}`.toLowerCase();

const modelNames = Object.keys(bp.models ?? {}).map((m) => m.toLowerCase());
const authPages = (bp.pages ?? []).filter((p) => p.auth === true).map((p) => (p.path ?? '').toLowerCase());
const pagePaths = (bp.pages ?? []).map((p) => (p.path ?? '').toLowerCase()).filter(Boolean);

for (let j = 0; j < features.length; j++) {
  const B = features[j];
  // rule 1: explicit
  for (const d of B.depends_on ?? []) addDep(B.name, d, 'explicit');
  for (let i = 0; i < j; i++) {
    const A = features[i];
    // rule 7 first: declared touches (prefix-glob intersection). Declared intent
    // is the strongest signal in both directions — an intersection is a hard
    // edge, and DISJOINT declarations suppress the name-matching heuristics
    // (rules 3–4) for this pair: the authors told us the file footprints.
    const ta = A.touches ? [...(A.touches.create ?? []), ...(A.touches.modify ?? [])] : [];
    const tb = B.touches ? [...(B.touches.create ?? []), ...(B.touches.modify ?? [])] : [];
    let touchesDisjoint = false;
    if (ta.length && tb.length) {
      const base = (g) => g.replace(/\*.*$/, '');
      const intersects = ta.some((x) => tb.some((y) => base(x).startsWith(base(y)) || base(y).startsWith(base(x))));
      if (intersects) addDep(B.name, A.name, 'touches-intersect');
      else touchesDisjoint = true;
    }
    // rule 2: auth (ordering policy — never suppressed by touches)
    if (isAuth(A) && !isAuth(B) && authPages.some((p) => p && text(B).includes(p))) {
      addDep(B.name, A.name, 'auth');
    }
    // rules 3–4: name-matching heuristics — skipped when declared touches prove disjoint footprints
    if (!touchesDisjoint) {
      if (modelNames.some((m) => text(A).includes(m) && text(B).includes(m))) {
        addDep(B.name, A.name, 'model-overlap');
      }
      if (pagePaths.some((p) => p !== '/' && text(A).includes(p) && text(B).includes(p))) {
        addDep(B.name, A.name, 'page-overlap');
      }
    } else if (modelNames.some((m) => text(A).includes(m) && text(B).includes(m))) {
      warnings.push(`model-overlap edge ${B.name} → ${A.name} suppressed: both declare disjoint touches`);
    }
    // rule 5: tests last (policy — never suppressed)
    if (isTest(B) && !isTest(A)) addDep(B.name, A.name, 'tests-last');
  }
}

// ---------- cycle detection ----------
function findCycle() {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(names.map((n) => [n, WHITE]));
  const stack = [];
  let cycle = null;
  function dfs(u) {
    color.set(u, GRAY);
    stack.push(u);
    for (const w of deps.get(u).keys()) {
      if (cycle) return;
      if (color.get(w) === GRAY) { cycle = [...stack.slice(stack.indexOf(w)), w]; return; }
      if (color.get(w) === WHITE) dfs(w);
    }
    stack.pop();
    color.set(u, BLACK);
  }
  for (const n of names) { if (color.get(n) === WHITE) dfs(n); if (cycle) break; }
  return cycle;
}
const cycle = findCycle();

// ---------- waves (topological levels) ----------
let waves = [];
if (!cycle) {
  const level = new Map();
  const compute = (n, seen = new Set()) => {
    if (level.has(n)) return level.get(n);
    seen.add(n);
    const l = Math.max(-1, ...[...deps.get(n).keys()].map((d) => compute(d, seen))) + 1;
    level.set(n, l);
    return l;
  };
  for (const n of names) compute(n);
  const max = Math.max(-1, ...level.values());
  for (let l = 0; l <= max; l++) waves.push(names.filter((n) => level.get(n) === l));
}

// ---------- splittable detection ----------
const FULLSTACK_SPECIALIST = /data table|admin list|searchable list|paginated list|dashboard|overview page|metrics|kpi|analytics|admin panel|manage |crud for /;
const splittable = features
  .filter((f) => {
    if (f.splittable === false) return false;
    if (f.splittable === true) return true;
    if (FULLSTACK_SPECIALIST.test(text(f))) return false;
    const layers = new Set((f.skills ?? []).map((s) => LAYERS.get(s)).filter(Boolean));
    return layers.has('frontend') && layers.has('backend');
  })
  .map((f) => f.name);

// ---------- mode decision ----------
const execution = bp.execution ?? 'auto';
let mode = 'parallel';
const reasons = [];
if (execution === 'sequential') { mode = 'sequential'; reasons.push('execution: sequential (explicit)'); }
else if (cycle) { mode = 'sequential'; reasons.push(`dependency cycle: ${cycle.join(' → ')}`); }
else if (execution === 'parallel') { reasons.push('execution: parallel (explicit — safety checks skipped)'); }
else {
  if (features.length > 20) { mode = 'sequential'; reasons.push(`too many features (${features.length} > 20)`); }
  if (waves.some((w) => w.length > 4)) { mode = 'sequential'; reasons.push('a wave exceeds 4 features (parallel agent cap)'); }
  if (!waves.some((w) => w.length >= 2)) { mode = 'sequential'; reasons.push('no wave has 2+ features (parallel buys nothing)'); }
  if (!features.some(isTest)) { mode = 'sequential'; reasons.push('no test feature (parallel work without tests is risky)'); }
  if (mode === 'parallel') reasons.push('all safety checks passed');
}
if (cycle && execution === 'parallel') {
  mode = 'sequential';
  reasons.push('explicit parallel overridden: graph has a cycle');
}

const plan = {
  blueprint: bp.name,
  mode,
  mode_reasons: reasons,
  dependencies: Object.fromEntries(
    names.map((n) => [n, [...deps.get(n)].map(([d, rule]) => ({ on: d, rule }))]),
  ),
  waves: mode === 'parallel' ? waves : names.map((n) => [n]),
  splittable,
  warnings,
};
process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
