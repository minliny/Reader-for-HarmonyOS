#!/usr/bin/env node
/**
 * Migration guard: current architecture work may reduce legacy consumers, but
 * it may not introduce new direct style or overlay implementations silently.
 * Existing entries are baseline exceptions until their migration package closes.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { auditTypographyConsumers, isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';

const root = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tools/architecture-consumer-baseline.json'), 'utf8'));
const featureRoot = path.join(root, 'entry/src/main/ets/features');
const patterns = {
  fontSize: /\.fontSize\s*\(/g,
  backgroundColor: /\.backgroundColor\s*\(/g,
  CustomDialogController: /CustomDialogController/g,
  showAlertDialog: /showAlertDialog/g,
  bindSheet: /\.bindSheet\s*\(/g,
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
const base = new Map([...baseline.rows, ...(baseline.sharedOwners ?? [])].map((row) => [row.file, row.counts]));
const violations = [];
for (const file of walk(featureRoot)) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const text = fs.readFileSync(file, 'utf8');
  const previous = base.get(rel) ?? {};
  for (const [name, pattern] of Object.entries(patterns)) {
    // A public role/spec consumer is not a new private font implementation.
    // Use the real ETS AST; lexical count also charged shared calls/comments
    // against legacy budgets and rejected newly honest feedback surfaces.
    const current = name === 'fontSize' && /\.fontSize\s*\(/.test(text)
      ? auditTypographyConsumers(text, rel).filter(node => node.modifiers.fontSize &&
        !isSharedTypographyExpression(node.modifiers.fontSize.expression)).length
      : name === 'fontSize' ? 0 : (text.match(pattern) ?? []).length;
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
