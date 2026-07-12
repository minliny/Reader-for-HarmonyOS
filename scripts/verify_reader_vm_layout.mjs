#!/usr/bin/env node

// Verify a HarmonyOS `uitest dumpLayout -a` reader snapshot.
//
// Usage:
//   node scripts/verify_reader_vm_layout.mjs /tmp/reader-horizontal.json
//   node scripts/verify_reader_vm_layout.mjs /tmp/reader-vertical.json --vertical

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const layoutPath = args.find((arg) => !arg.startsWith('--'));
const vertical = args.includes('--vertical');

if (!layoutPath) {
  console.error('usage: node scripts/verify_reader_vm_layout.mjs <layout.json> [--vertical]');
  process.exit(2);
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function boundsOf(node) {
  const value = node?.attributes?.bounds ?? '';
  const match = value.match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/);
  if (!match) return null;
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  };
}

function width(bounds) {
  return bounds.right - bounds.left;
}

function height(bounds) {
  return bounds.bottom - bounds.top;
}

const root = JSON.parse(fs.readFileSync(path.resolve(layoutPath), 'utf8'));
const rootBounds = boundsOf(root);
assert(rootBounds && width(rootBounds) > 0 && height(rootBounds) > 0,
  'layout root must expose a non-empty viewport');

const entries = [];
function visit(node, ancestors = []) {
  const currentPath = [...ancestors, node];
  entries.push({ node, ancestors, path: currentPath });
  for (const child of node.children ?? []) visit(child, currentPath);
}
visit(root);

const textEntries = entries.filter(({ node }) => (node.attributes?.text ?? '').length > 0);
const visibleTexts = textEntries.map(({ node }) => node.attributes.text);
const debugMarkers = [
  'ReadingTextLayer:H',
  'ReadingTextLayer:V',
  'ImmersiveInfoLayer',
  'PrevPageHotzone',
  'ControlLayerHotzone',
  'NextPageHotzone',
];
for (const marker of debugMarkers) {
  assert(!visibleTexts.includes(marker), `development overlay leaked into normal reader: ${marker}`);
}

const bodyEntries = textEntries.filter(({ node }) => {
  const text = node.attributes.text ?? '';
  return text.length >= 20 && text !== '长夜余火 · 第 32 章 雨夜';
});
assert(bodyEntries.length > 0, 'reader snapshot must contain body text');

const firstBody = bodyEntries[0];
const frameCandidates = firstBody.ancestors.filter((node) => {
  const bounds = boundsOf(node);
  return node.attributes?.type === 'Column' && bounds &&
    bounds.left > rootBounds.left && bounds.right < rootBounds.right &&
    width(bounds) > width(rootBounds) * 0.5;
});
assert(frameCandidates.length > 0, 'body text must be owned by an inset Column frame');
const textFrame = frameCandidates.reduce((largest, node) => {
  return height(boundsOf(node)) > height(boundsOf(largest)) ? node : largest;
});
const frameBounds = boundsOf(textFrame);

// Reader UI defines a 32vp side inset. It also gives us a density-independent
// scale for validating the 72vp top and >=48vp bottom frame without assuming a
// particular emulator resolution.
const leftInset = frameBounds.left - rootBounds.left;
const rightInset = rootBounds.right - frameBounds.right;
const density = (leftInset + rightInset) / (2 * 32);
assert(density > 0, 'reader density inferred from side margins must be positive');
assert(Math.abs(leftInset - rightInset) / density <= 1,
  `reader side margins are not balanced: left=${leftInset / density}vp right=${rightInset / density}vp`);

const topInsetVp = (frameBounds.top - rootBounds.top) / density;
const bottomInsetVp = (rootBounds.bottom - frameBounds.bottom) / density;
assert(topInsetVp >= 70 && topInsetVp <= 74,
  `reader top inset drifted from 72vp: ${topInsetVp.toFixed(2)}vp`);
assert(bottomInsetVp >= 48 && bottomInsetVp <= 64,
  `reader bottom inset must preserve the 48vp floor: ${bottomInsetVp.toFixed(2)}vp`);

const pageLabelEntries = textEntries.filter(({ node }) =>
  /^第 \d+ \/ \d+ 页$/.test(node.attributes?.text ?? ''));

if (vertical) {
  assert(pageLabelEntries.length === 0, 'vertical reading must not expose a page label');
  assert(firstBody.ancestors.some((node) => node.attributes?.type === 'Scroll'),
    'vertical reading body must be owned by a Scroll');
} else {
  assert(pageLabelEntries.length === 1, 'horizontal reading must expose one reducer-backed page label');
  const footerBounds = boundsOf(pageLabelEntries[0].node);
  const bodyInFrame = bodyEntries.filter(({ ancestors }) => ancestors.includes(textFrame));
  const bodyBottom = Math.max(...bodyInFrame.map(({ node }) => boundsOf(node)?.bottom ?? 0));
  assert(bodyBottom <= footerBounds.top,
    `horizontal body overlaps footer: bodyBottom=${bodyBottom} footerTop=${footerBounds.top}`);
}

console.log([
  `PASS ${vertical ? 'vertical' : 'horizontal'} reader layout`,
  `side=${(leftInset / density).toFixed(1)}vp/${(rightInset / density).toFixed(1)}vp`,
  `top=${topInsetVp.toFixed(1)}vp`,
  `bottom=${bottomInsetVp.toFixed(1)}vp`,
].join(' '));
