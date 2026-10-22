#!/usr/bin/env node
/**
 * #964 – Mutation score recorder
 *
 * Reads the JSON report produced by Stryker
 * (`reports/mutation/mutation.json`) and appends a dated entry to
 * `mutation-score.md` so the score history is preserved in the repo.
 *
 * Usage (from /frontend):
 *   npm run mutation:score
 *
 * The script exits with code 1 if the overall score is below the minimum
 * threshold so it can be used as a CI gate.
 */

import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const REPORT_PATH = join(ROOT, 'reports', 'mutation', 'mutation.json');
const SCORE_LOG   = join(ROOT, 'mutation-score.md');
const MIN_SCORE   = 80; // must match stryker.config.cjs thresholds.break

// ─── Parse Stryker JSON report ────────────────────────────────────────────────

if (!existsSync(REPORT_PATH)) {
  console.error(`[mutation:score] Report not found: ${REPORT_PATH}`);
  console.error('  Run `npm run mutation` first.');
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));

/**
 * Stryker JSON schema (v1): top-level `files` map with per-file mutant arrays.
 * Each mutant has a `status` field: "Killed" | "Survived" | "NoCoverage" |
 * "Timeout" | "CompileError" | "RuntimeError".
 */
const allMutants = Object.values(report.files ?? {}).flatMap((f) => f.mutants ?? []);

const killed   = allMutants.filter((m) => m.status === 'Killed').length;
const survived = allMutants.filter((m) => m.status === 'Survived').length;
const timeout  = allMutants.filter((m) => m.status === 'Timeout').length;
const total    = allMutants.filter((m) =>
  ['Killed', 'Survived', 'Timeout', 'NoCoverage'].includes(m.status)
).length;

const score = total > 0 ? Math.round((killed / total) * 100) : 0;
const date  = new Date().toISOString().slice(0, 19).replace('T', ' ');

// ─── Per-file breakdown ───────────────────────────────────────────────────────

const fileBreakdown = Object.entries(report.files ?? {})
  .map(([file, data]) => {
    const mutants = data.mutants ?? [];
    const fKilled   = mutants.filter((m) => m.status === 'Killed').length;
    const fTotal    = mutants.filter((m) =>
      ['Killed', 'Survived', 'Timeout', 'NoCoverage'].includes(m.status)
    ).length;
    const fScore = fTotal > 0 ? Math.round((fKilled / fTotal) * 100) : 0;
    return `  - \`${file}\`: ${fScore}% (${fKilled}/${fTotal})`;
  })
  .join('\n');

// ─── Console output ───────────────────────────────────────────────────────────

console.log(`\n  Mutation score  : ${score}%`);
console.log(`  Killed          : ${killed}`);
console.log(`  Survived        : ${survived}`);
console.log(`  Timeout         : ${timeout}`);
console.log(`  Total mutants   : ${total}`);
console.log(`  Threshold       : ${MIN_SCORE}%\n`);

// ─── Append to score log ──────────────────────────────────────────────────────

const header = existsSync(SCORE_LOG)
  ? ''
  : '# Mutation Score History\n\n' +
    '| Date (UTC)          | Score | Killed | Survived | Timeout | Total |\n' +
    '|---------------------|-------|--------|----------|---------|-------|\n';

const row =
  `| ${date} | ${score.toString().padStart(3)}%  | ${String(killed).padStart(6)} | ${String(survived).padStart(8)} | ${String(timeout).padStart(7)} | ${String(total).padStart(5)} |\n`;

const detail =
  `\n### ${date}\n\nPer-file breakdown:\n\n${fileBreakdown}\n\n` +
  (survived > 0
    ? `> **${survived} surviving mutant(s) detected** — review \`reports/mutation/index.html\` for details.\n`
    : '> All mutants killed ✅\n');

if (!existsSync(SCORE_LOG)) {
  writeFileSync(SCORE_LOG, header + row + detail, 'utf8');
} else {
  appendFileSync(SCORE_LOG, row + detail, 'utf8');
}

console.log(`  Score recorded → ${SCORE_LOG}`);

// ─── CI gate ──────────────────────────────────────────────────────────────────

if (score < MIN_SCORE) {
  console.error(`\n  ✗ Mutation score ${score}% is below minimum ${MIN_SCORE}%.`);
  console.error('    Address surviving mutants before merging.\n');
  process.exit(1);
}

console.log(`  ✓ Mutation score ${score}% meets the ${MIN_SCORE}% threshold.\n`);
