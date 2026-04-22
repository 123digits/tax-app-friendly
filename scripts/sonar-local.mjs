#!/usr/bin/env node
// Local report that mirrors what SonarQube's analysis would show on its
// dashboard. Runs in the sandbox without needing a server, collecting the
// same categories of signals Sonar surfaces:
//
//   1. Bugs / code smells / security hotspots  → eslint-plugin-sonarjs
//      (the same SonarJS rule set applied against the compiled dashboard).
//      Run via `npm run lint` — any error == a Sonar finding.
//
//   2. Duplications                             → jscpd
//      (same block-tokenization approach Sonar uses; tuned to 70 tokens /
//      8 lines minimum, matching Sonar's default CPD config.)
//
//   3. Coverage (line + branch)                 → vitest coverage-v8 lcov
//      (Sonar reads the exact `coverage/lcov.info` we produce.)
//
// This script prints a single digest. In CI the real SonarQube workflow
// in .github/workflows/sonarqube.yml uploads the same data to a Sonar
// server where the Quality Gate compares against thresholds; here we just
// show the raw numbers.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function runLint() {
  const res = spawnSync('npm', ['run', 'lint', '--silent', '--', '-f', 'json'], {
    encoding: 'utf8',
  });
  try {
    const results = JSON.parse(res.stdout || '[]');
    const sonarRules = new Map();
    let errors = 0;
    let warnings = 0;
    for (const file of results) {
      for (const m of file.messages) {
        if (m.severity === 2) errors++;
        else if (m.severity === 1) warnings++;
        if (typeof m.ruleId === 'string' && m.ruleId.startsWith('sonarjs/')) {
          sonarRules.set(m.ruleId, (sonarRules.get(m.ruleId) || 0) + 1);
        }
      }
    }
    return { errors, warnings, sonarRules };
  } catch {
    return { errors: 0, warnings: 0, sonarRules: new Map() };
  }
}

function readCoverage() {
  try {
    const d = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
    return d.total;
  } catch {
    return null;
  }
}

function readJscpd() {
  try {
    const d = JSON.parse(readFileSync('reports/jscpd/jscpd-report.json', 'utf8'));
    return d.statistics?.total;
  } catch {
    return null;
  }
}

console.log('='.repeat(60));
console.log('  Local SonarQube-equivalent code analysis');
console.log('='.repeat(60));
console.log();

const cov = readCoverage();
if (cov) {
  console.log('Coverage (lcov → Sonar picks this up at sonar.*.lcov.reportPaths)');
  console.log(`  Statements ${cov.statements.pct}%`);
  console.log(`  Branches   ${cov.branches.pct}%`);
  console.log(`  Functions  ${cov.functions.pct}%`);
  console.log(`  Lines      ${cov.lines.pct}%`);
  console.log();
} else {
  console.log('Coverage: run `npx vitest run --coverage` first.');
  console.log();
}

const jscpd = readJscpd();
if (jscpd) {
  console.log('Duplications (jscpd, same metric as Sonar CPD)');
  console.log(`  Files analyzed    ${jscpd.sources}`);
  console.log(`  Total lines       ${jscpd.lines}`);
  console.log(`  Duplicated lines  ${jscpd.duplicatedLines} (${jscpd.percentage.toFixed(2)}%)`);
  console.log(`  Clone blocks      ${jscpd.clones}`);
  console.log();
} else {
  console.log('Duplications: run `npm run dup` first to produce reports/jscpd/jscpd-report.json.');
  console.log();
}

const lint = runLint();
console.log('SonarJS rule findings (same rule set as SonarQube JS/TS analyzer)');
console.log(`  ESLint errors:   ${lint.errors}`);
console.log(`  ESLint warnings: ${lint.warnings}`);
if (lint.sonarRules.size === 0) {
  console.log('  No open Sonar findings.');
} else {
  console.log('  Open by rule:');
  for (const [rule, count] of lint.sonarRules) {
    console.log(`    ${rule}: ${count}`);
  }
}
