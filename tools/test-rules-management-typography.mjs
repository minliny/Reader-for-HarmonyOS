import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  new Function(...Object.keys(fontFamilies), `${stripTypeScriptTypes(typographySource)
    .replace(/^import[^;]+;\s*/gm, '')
    .replace(/^export /gm, '')}; return { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };`)(
      ...Object.values(fontFamilies));
const page = read('features/settings/RulesManagementPage.ets');

assert.deepEqual(
  [TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION].map(style => ({
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSizeFp: style.fontSizeFp,
    lineHeightFp: style.lineHeightFp,
  })),
  [
    { fontFamily: 'ReaderNotoSansSC', fontWeight: 700, fontSizeFp: 14, lineHeightFp: undefined },
    { fontFamily: 'ReaderNotoSansSC', fontWeight: 400, fontSizeFp: 12, lineHeightFp: undefined },
    { fontFamily: 'ReaderNotoSansSC', fontWeight: 700, fontSizeFp: 12, lineHeightFp: undefined },
  ],
  'rules-management roles preserve the existing heading/editor/action tuples',
);

const headingStart = page.indexOf('private heading(value: string)');
const inputStart = page.indexOf('private input(value: string');
const actionStart = page.indexOf('private actionButton(label: string');
assert.ok(headingStart >= 0 && inputStart > headingStart && actionStart > inputStart,
  'rules-management typography builders remain discoverable');
const heading = page.slice(headingStart, inputStart);
const input = page.slice(inputStart, page.indexOf('private booleanField', inputStart));
const action = page.slice(actionStart, page.indexOf('private entityRow', actionStart));

for (const [source, role, label] of [
  [heading, 'TYPE_RULES_MANAGEMENT_HEADING', 'heading'],
  [input, 'TYPE_RULES_MANAGEMENT_INPUT', 'input'],
  [action, 'TYPE_RULES_MANAGEMENT_ACTION', 'action button'],
]) {
  for (const property of ['fontFamily', 'fontWeight', 'fontSizeFp']) {
    assert.match(source, new RegExp(`${role}\\.${property}`), `${label} uses ${role}.${property}`);
  }
}

assert.doesNotMatch(heading, /fontFamily\('ReaderNotoSansSC'\)|fontWeight\(FontWeight\.Bold\)|fontSize\(14\)/,
  'rules-management heading no longer owns the physical tuple');
assert.doesNotMatch(input, /fontFamily\('ReaderNotoSansSC'\)|fontSize\(12\)/,
  'rules-management input no longer owns the physical tuple');
assert.doesNotMatch(action, /fontWeight\(FontWeight\.Bold\)|fontSize\(12\)/,
  'rules-management action no longer owns the physical tuple');

console.log('PASS rules-management heading, editor and action text use shared ReaderTypography roles');
