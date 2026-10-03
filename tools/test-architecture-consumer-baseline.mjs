#!/usr/bin/env node
/**
 * Migration guard: current architecture work may reduce legacy consumers, but
 * it may not introduce new direct style or overlay implementations silently.
 * Existing entries are baseline exceptions until their migration package closes.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tools/architecture-consumer-baseline.json'), 'utf8'));
const featureRoot = path.join(root, 'entry/src/main/ets/features');
const patterns = {
  fontSize: /\.fontSize\s*\(/g,
  backgroundColor: /\.backgroundColor\s*\(/g,
  CustomDialogController: /CustomDialogController/g,
  showAlertDialog: /showAlertDialog/g,
  bindSheet: /\.bindSheet/g,
  bindPopup: /\.bindPopup/g,
  bindContentCover: /\.bindContentCover/g,
  bindMenu: /\.bindMenu/g,
};
function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(file));
    else if (/\.(ets|ts)$/.test(entry.name)) result.push(file);
  }
  return result;
}
const base = new Map(baseline.rows.map((row) => [row.file, row.counts]));
const violations = [];
for (const file of walk(featureRoot)) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');
  const previous = base.get(rel) ?? {};
  for (const [name, pattern] of Object.entries(patterns)) {
    const current = (text.match(pattern) ?? []).length;
    if (current > (previous[name] ?? 0)) {
      violations.push(`${rel}: ${name} ${current} > baseline ${previous[name] ?? 0}`);
    }
  }
}
if (violations.length) {
  console.error('architecture consumer baseline FAILED');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log(`architecture consumer baseline PASS (${baseline.rows.length} registered files)`);
