import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

// Snapshot of the actual replaced local constants, captured before migration.
// Verify authored Day/alpha and the live consumers, not just registry presence.
const rows = JSON.parse(readFileSync(new URL('../evidence/2026-09-13-current-gap-register/theme-consumer-bindings.json', import.meta.url)))
  .filter(row => row.originalConstant !== undefined);
assert.equal(new Set(rows.map(row => row.role)).size, 46);
assert.equal(new Set(rows.map(row => row.file)).size, 11);
for (const row of rows) {
  assert.equal(readerAppColor(row.role, 'day'), row.day, `${row.role}: Day retained`);
  assert.equal(readerAppColor(row.role, 'night'), row.night, `${row.role}: Night mapped`);
  assert.equal(row.day.slice(1, 3), row.night.slice(1, 3), `${row.role}: authored alpha retained`);
  const source = readFileSync(new URL(`../entry/src/main/ets/${row.file}`, import.meta.url), 'utf8');
  assert.ok(source.includes(`readerAppColor('${row.role}', this.appThemeScheme)`), `${row.file}: live registry consumption`);
  assert.ok(source.includes("@StorageLink('readerAppScheme')"), `${row.file}: reactive App scope`);
  assert.ok(!source.includes(`const ${row.originalConstant} =`), `${row.file}: no duplicate local palette`);
}

const SourcePage = productionMotionMethods(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets', import.meta.url),
  ['statusBadgeBackground', 'statusBadgeDot']);
const page = new SourcePage();
for (const scheme of ['day', 'night']) {
  page.appThemeScheme = scheme;
  const good = page.statusBadgeDot({ checkState: 'passed' });
  const error = page.statusBadgeDot({ checkState: 'failed' });
  const muted = page.statusBadgeDot({ checkState: 'unchecked' });
  assert.equal(new Set([good, error, muted]).size, 3, 'status meanings remain distinct');
  const channels = color => [color.slice(3, 5), color.slice(5, 7), color.slice(7, 9)].map(v => parseInt(v, 16));
  const [gr, gg, gb] = channels(good), [er, eg, eb] = channels(error);
  assert.ok(gg > gr && gg > gb, 'success remains green');
  assert.ok(er > eg && er > eb, 'failure remains red');
  for (const state of ['passed', 'failed', 'unchecked']) {
    const background = page.statusBadgeBackground({ checkState: state });
    assert.ok(background.startsWith(state === 'unchecked' ? '#1F' : '#21'), 'native alpha retained');
  }
}
assert.equal(readerAppColor('app.ReaderBookmarkEmptyState.EMPTY_STATE_BUTTON_COLOR', 'night'), '#FF1C1A18',
  'bookmark action text contrasts with the light control primary');
assert.equal(readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', 'night'), '#FFFFFAF4',
  'shelf selected text stays light on its dark action fill');
console.log(`PASS ${rows.length} local-color bindings / 46 roles: authored Day and alpha, reactive App scope, distinct production status states and action foregrounds.`);
