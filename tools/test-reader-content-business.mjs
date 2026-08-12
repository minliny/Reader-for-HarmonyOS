import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readingRoot = path.join(root, 'entry/src/main/ets/features/reading');
const experiencePath = path.join(readingRoot, 'LocalReadingExperience.ets');
const controlPath = path.join(readingRoot, 'ReaderControlPanel.ets');
const experienceSource = fs.readFileSync(experiencePath, 'utf8');
const controlSource = fs.readFileSync(controlPath, 'utf8');

assert.equal(fs.existsSync(path.join(readingRoot, 'ReaderContentBusinessGateway.ts')), false,
  'the unplanned ContentEdit/chapter-review ArkUI gateway must remain removed');
assert.equal(fs.existsSync(path.join(readingRoot, 'ReaderContentBusinessPanel.ets')), false,
  'the unplanned ContentEdit/chapter-review panel must remain removed');
assert.doesNotMatch(experienceSource,
  /ReaderContentBusiness|contentBusiness|content-edit\.|chapterReview|saveContentBusinessEdit|restoreContentBusinessOriginal/,
  'the production reader must not retain a dormant ContentEdit or chapter-review route');
assert.match(controlSource, /onMore: \(\) => void/);
assert.match(controlSource, /enabled\(false\)[\s\S]{0,100}accessibilityText\('更多功能，暂不可用'\)/,
  'the generic future entry remains visible but must not imply a ContentEdit product');
assert.match(experienceSource, /onMore:\s*\(\): void => \{\}/,
  'the visible future entry must stay disconnected until a product capability is specified');

console.log('reader content business isolation: PASS');
