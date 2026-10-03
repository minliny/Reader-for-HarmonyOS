import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { auditTypographyConsumers } from './reader-typography-consumer-audit.mjs';

export function typographySuccessorFile(baseline, path) {
  if (!baseline.successorFixture) return undefined;
  assert.match(baseline.successorFixture, /^[a-z0-9-]+\.json$/);
  return JSON.parse(readFileSync(new URL(`../fixtures/design/${baseline.successorFixture}`, import.meta.url))).files.find(file => file.path === path);
}

/** A later finite-state batch may replace a role/remaining expression captured
 * by an earlier static batch. Preserve the original evidence and recognise only
 * explicitly registered successors, never arbitrary per-page overrides. */
export function typographySuccessorNode(expected, successor) {
  const next = successor?.nodes.find(node => node.method === expected.method && node.kind === expected.kind &&
    node.text === expected.text && node.original.fontSize === expected.changes.fontSize);
  return next ? { ...expected, changes: next.changes } : expected;
}

/** Reverse only this migration's real modifier arguments, exact imported role
 * list and explicitly recorded non-font cleanup; prove the predecessor source
 * byte-for-byte. No git checkout or production file writes are involved. */
export function restoreTypographyMigration(source, file, { verifySource = true } = {}) {
  const consumers = auditTypographyConsumers(source, file.path), used = new Set(), edits = [];
  for (const expected of file.nodes) {
    const actual = consumers.find(node => !used.has(node) && node.method === expected.method && node.kind === expected.kind &&
      node.text === expected.text && Object.entries(expected.changes).every(([property, value]) => node.modifiers[property]?.expression === value));
    assert.ok(actual, `${file.path}/${expected.method}: exact migration consumer exists`); used.add(actual);
    for (const [property, value] of Object.entries(expected.original))
      edits.push({ ...actual.modifiers[property], value });
  }
  for (const edit of edits.sort((a,b) => b.start-a.start)) source = source.slice(0, edit.start)+edit.value+source.slice(edit.end);
  assert.ok(source.startsWith(file.roleImport), `${file.path}: exact migration import`);
  source = source.slice(file.roleImport.length);
  for (const extra of file.extras ?? []) {
    assert.ok(extra.after && source.includes(extra.after), `${file.path}: reversible declared cleanup`);
    source = source.replace(extra.after, extra.before);
  }
  if (verifySource) assert.equal(createHash('sha256').update(source).digest('hex'), file.sha256, `${file.path}: source/callback/layout predecessor is byte-identical`);
  return source;
}
