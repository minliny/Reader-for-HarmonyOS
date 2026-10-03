import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadReaderTypographyRoles, readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/source-tools-typography-baseline.json', import.meta.url)));
const properties = {
  fontFamily: 'fontFamily', fontWeight: 'fontWeight', fontSize: 'fontSizeFp',
  lineHeight: 'lineHeightFp', letterSpacing: 'letterSpacingFp',
};
assert.equal(baseline.nodes.length, 25, 'baseline covers the full source-tools text family');
assert.equal(new Set(baseline.nodes.map(node => node.role)).size, 14, 'distinct authored tuples have bounded roles');

const expectedBindings = new Map();
for (const node of baseline.nodes) {
  const style = readerTypographyRoles[node.role];
  assert.ok(style, `${node.role}: real role export is loadable`);
  for (const [nativeProperty, property] of Object.entries(properties)) {
    assert.equal(style[property], node.tuple[nativeProperty], `${node.method}/${node.index}: ${property} preserves value or AUTO`);
    if (Object.hasOwn(node.tuple, nativeProperty)) {
      const key = `${node.role}.${property}`;
      expectedBindings.set(key, (expectedBindings.get(key) ?? 0) + 1);
    }
  }
  assert.equal(style.scalePolicy, 'system');
  assert.equal(style.source, 'appBaseline');
}
for (const [binding, expected] of expectedBindings) {
  assert.equal(source.split(binding).length - 1, expected, `${binding}: all authored consumers are migrated`);
}
assert.equal((source.match(/\.fontSize\(/g) ?? []).length, 25);
assert.equal((source.match(/\.fontSize\(TYPE_SOURCE_TOOLS_[A-Z_]+\.fontSizeFp\)/g) ?? []).length, 25,
  'every source-tools size consumes its public role');
assert.doesNotMatch(source, /\.fontFamily\(['"]|\.fontSize\(\d|\.lineHeight\(\d|\.fontWeight\(FontWeight/,
  'the whole page must not retain a private physical tuple');

// The shared probe automatically discovers future roles instead of requiring
// each existing test to add another hard-coded dependency object.
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const extended = loadReaderTypographyRoles(`${typographySource}\nexport const TYPE_PROBE_NEW_ROLE = TYPE_SOURCE_TOOLS_NOTE;\n`);
assert.deepEqual(extended.TYPE_PROBE_NEW_ROLE, extended.TYPE_SOURCE_TOOLS_NOTE);

console.log('PASS source-tools complete text family: 25 nodes / 14 real roles, explicit tuples and AUTO preserved');
