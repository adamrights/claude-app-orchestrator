// Tests for the repo's zero-dep tooling: validate-blueprint, build-skill-map,
// check-references, install.sh. Run with: node --test scripts/
// No npm dependencies — node:test only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'kb-scripts-test-'));

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', ...opts });
}
function validate(yamlText) {
  const file = join(tmp, `bp-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(file, yamlText);
  return run('node', ['scripts/validate-blueprint.mjs', file]);
}

// ---------- validate-blueprint.mjs ----------

test('validator: every shipped example blueprint passes', () => {
  const files = [
    ...readdirSync(join(repoRoot, 'blueprints/examples')).map((f) => `blueprints/examples/${f}`),
    'examples/built/helpdesk/blueprint.yaml',
  ].filter((f) => f.endsWith('.yaml'));
  assert.ok(files.length >= 5, `expected several examples, got ${files.length}`);
  for (const f of files) {
    const r = run('node', ['scripts/validate-blueprint.mjs', f]);
    assert.equal(r.status, 0, `${f} failed:\n${r.stdout}${r.stderr}`);
  }
});

test('validator: missing name/description/features exit 1 with per-field errors', () => {
  const r = validate('stack:\n  type: spa\n');
  assert.equal(r.status, 1);
  for (const field of ["'name'", "'description'", "'features'"]) {
    assert.match(r.stdout + r.stderr, new RegExp(field), `should mention ${field}`);
  }
});

test('validator: unknown skill gets a did-you-mean suggestion', () => {
  const r = validate(
    'name: x\ndescription: d\nstack:\n  type: spa\nfeatures:\n  - name: f\n    description: d\n    skills: [react-compnent]\n',
  );
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Did you mean 'react-component'/);
});

test('validator: unknown stack.type lists the allowed values', () => {
  const r = validate('name: x\ndescription: d\nstack:\n  type: spaceship\nfeatures:\n  - name: f\n    description: d\n    skills: [styling]\n');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /fullstack, spa, api/);
});

test('validator: dependency cycles are reported with the cycle path', () => {
  const r = validate(
    'name: x\ndescription: d\nstack:\n  type: spa\nfeatures:\n  - name: a\n    description: d\n    skills: [styling]\n    depends_on: [b]\n  - name: b\n    description: d\n    skills: [styling]\n    depends_on: [a]\n',
  );
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Cycle in feature dependencies: a → b → a/);
});

test('validator: depends_on referencing an unknown feature exits 1', () => {
  const r = validate(
    'name: x\ndescription: d\nstack:\n  type: spa\nfeatures:\n  - name: a\n    description: d\n    skills: [styling]\n    depends_on: [ghost]\n',
  );
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /unknown feature 'ghost'/);
});

test('validator: flow-style feature entries parse (regression: used to misparse)', () => {
  const r = validate(
    'name: x\ndescription: d\nstack: {type: spa}\nfeatures:\n  - {name: a, description: d, skills: [styling], depends_on: [b]}\n  - {name: b, description: d, skills: [styling]}\n',
  );
  assert.equal(r.status, 0, `flow-style blueprint should validate:\n${r.stdout}${r.stderr}`);
});

// ---------- build-skill-map.mjs ----------

const manifestPath = join(repoRoot, 'skills/manifest.yaml');
const manifestBackup = readFileSync(manifestPath, 'utf8');

function withManifest(mutate, fn) {
  writeFileSync(manifestPath, mutate(manifestBackup));
  try {
    return fn();
  } finally {
    writeFileSync(manifestPath, manifestBackup);
  }
}

test('skill map: --check passes on the committed repo state', () => {
  const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('skill map: duplicate short name fails --check', () => {
  withManifest(
    (s) => s.replace('  - name: docker', '  - name: styling'),
    () => {
      const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /duplicate skill name 'styling'/);
    },
  );
});

test('skill map: unknown layer fails --check', () => {
  withManifest(
    (s) => s.replace('    layer: devops', '    layer: sideways'),
    () => {
      const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /unknown layer 'sideways'/);
    },
  );
});

test('skill map: manifest entry pointing at a missing file fails --check', () => {
  withManifest(
    (s) => s.replace('path: skills/devops/docker.md', 'path: skills/devops/dokker.md'),
    () => {
      const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /path does not exist/);
    },
  );
});

test('skill map: drift in a generated output fails --check with the file named', () => {
  const orchPath = join(repoRoot, 'agents/orchestrator.md');
  const orchBackup = readFileSync(orchPath, 'utf8');
  writeFileSync(orchPath, orchBackup.replace('| `docker` | `skills/devops/docker.md` | devops |', '| `docker` | `skills/devops/docker.md` | frontend |'));
  try {
    const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /stale: agents\/orchestrator\.md/);
  } finally {
    writeFileSync(orchPath, orchBackup);
  }
});

test('skill map: hand-edited directory README fails --check', () => {
  const readmePath = join(repoRoot, 'skills/frontend/README.md');
  const backup = readFileSync(readmePath, 'utf8');
  writeFileSync(readmePath, backup + '\nhand edit\n');
  try {
    const r = run('node', ['scripts/build-skill-map.mjs', '--check']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /skills\/frontend\/README\.md/);
  } finally {
    writeFileSync(readmePath, backup);
  }
});

// ---------- plan-waves.mjs ----------

function plan(yamlText) {
  const file = join(tmp, `plan-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(file, yamlText);
  const r = run('node', ['scripts/plan-waves.mjs', file]);
  return { ...r, plan: r.status === 0 ? JSON.parse(r.stdout) : null };
}

const PARALLEL_BP = `name: p
description: d
stack:
  type: spa
features:
  - name: a
    description: feature a
    skills: [styling]
  - name: b
    description: feature b
    skills: [styling]
  - name: tests
    description: tests
    skills: [react-testing]
`;

test('planner: independent features share a wave; tests wave follows', () => {
  const { plan: p, status } = plan(PARALLEL_BP);
  assert.equal(status, 0);
  assert.equal(p.mode, 'parallel');
  assert.deepEqual(p.waves, [['a', 'b'], ['tests']]);
});

test('planner: linear depends_on chain falls back to sequential with the reason', () => {
  const r = run('node', ['scripts/plan-waves.mjs', 'blueprints/examples/todo-app.yaml']);
  const p = JSON.parse(r.stdout);
  assert.equal(p.mode, 'sequential');
  assert.ok(p.mode_reasons.some((m) => m.includes('no wave has 2+')));
});

test('planner: missing test feature forces sequential', () => {
  const { plan: p } = plan(PARALLEL_BP.replace(/  - name: tests[\s\S]*$/, ''));
  assert.equal(p.mode, 'sequential');
  assert.ok(p.mode_reasons.some((m) => m.includes('no test feature')));
});

test('planner: explicit parallel skips safety checks but never a cycle', () => {
  const { plan: p } = plan(PARALLEL_BP.replace('features:', 'execution: parallel\nfeatures:'));
  assert.equal(p.mode, 'parallel');
  assert.ok(p.mode_reasons.some((m) => m.includes('safety checks skipped')));
});

test('planner: frontend+backend skills mark a feature splittable; fullstack-specialist keywords do not', () => {
  const bp = `name: s
description: d
stack:
  type: fullstack
features:
  - name: notes
    description: notes feature with api and ui
    skills: [api-design, react-component]
  - name: admin-panel
    description: admin panel to manage users, CRUD for users
    skills: [api-design, react-component]
  - name: tests
    description: tests
    skills: [react-testing]
`;
  const { plan: p } = plan(bp);
  assert.deepEqual(p.splittable, ['notes']);
});

test('planner: rejects an invalid blueprint instead of planning it', () => {
  const { status, stderr } = plan('name: x\nfeatures: []\n');
  assert.equal(status, 1);
  assert.match(stderr, /failed validation/);
});

// ---------- check-references.mjs ----------

test('check-references: passes on the committed repo state', () => {
  const r = run('node', ['scripts/check-references.mjs']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// ---------- install.sh ----------

test('install.sh: sandboxed install is complete, idempotent, and uninstalls cleanly', () => {
  const home = mkdtempSync(join(tmpdir(), 'kb-fakehome-'));
  const env = { ...process.env, HOME: home };
  const commandCount = readdirSync(join(repoRoot, '.claude/commands')).filter((f) => f.endsWith('.md')).length;

  const install = run('./install.sh', [], { env });
  assert.equal(install.status, 0, install.stderr);
  const linked = readdirSync(join(home, '.claude/commands'));
  assert.equal(linked.length, commandCount, `expected ${commandCount} symlinks, got ${linked.length}`);
  assert.ok(existsSync(join(home, '.config/claude-app-orchestrator/path')), 'path config written');

  const again = run('./install.sh', [], { env });
  assert.equal(again.status, 0, 'reinstall must be idempotent');
  assert.match(again.stdout, /already linked/);

  const un = run('./install.sh', ['--uninstall'], { env });
  assert.equal(un.status, 0, un.stderr);
  assert.equal(readdirSync(join(home, '.claude/commands')).length, 0, 'all links removed');
  assert.ok(!existsSync(join(home, '.config/claude-app-orchestrator/path')), 'path config removed');

  rmSync(home, { recursive: true, force: true });
});
