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
assert.match(controlSource, /onRefreshChapter: \(\) => void/);
const moreActor = controlSource.match(/\/\/ MoreHitArea 34×42[\s\S]*?\.accessibilityText\('更多'\);/);
assert.ok(moreActor, 'the Figma More actor must remain present');
assert.doesNotMatch(moreActor[0], /\.opacity\(0\.4\)|\.enabled\(false\)/,
  'Figma `933:59` defines a normal More actor, not an invented disabled state');
assert.match(experienceSource, /onRefreshChapter:\s*\(\): void => this\.refreshCurrentChapter\(\)/,
  'PH58 refresh uses the original guarded reading selection path');
assert.match(moreActor[0], /\.onClick\(\(\): void => this\.setMoreMenuVisible\(!this\.moreMenuVisible\)\)/,
  'the More actor opens its real menu; it cannot mutate a bookmark directly');

console.log('reader content business isolation: PASS');
