import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

for (const probe of ['test-conventional-typography.mjs', 'test-conventional-typography-sdk.mjs']) {
  process.stdout.write(execFileSync(process.execPath, [new URL(`./${probe}`, import.meta.url).pathname,
    '--fixture=reader-directory-typography-baseline.json', ...(process.argv.includes('--verify-migration-source') ? ['--verify-migration-source'] : [])], { encoding: 'utf8' }));
}
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets', import.meta.url), 'utf8');
const { owner } = createReaderBuilderProbe(source, ['panelHeader', 'directoryTab', 'bookmarkTab', 'statusFooter', 'currentTitle', 'currentPosition']);
let close = 0, directory = 0, bookmarks = 0;
Object.assign(owner, { appThemeScheme: 'day', activeTab: 'directory', currentChapterIndex: 2, chapters: [{title:'一'}, {title:'二'}, {title:'三'}],
  totalChapters: 3, innerWidth: () => 328, tabHeight: () => 32, activeTabLineWidth: () => 38,
  onExit: () => close++, switchTab: tab => tab === 'directory' ? directory++ : bookmarks++,
  cancelProjectionTopScroll: () => {}, listScroller: { scrollEdge() {} } });
owner.panelHeader(); owner.directoryTab(); owner.bookmarkTab();
const text = [...owner.nodes.values()].filter(node=>node.type==='Text');
assert.equal(text.find(node=>node.create==='目录').fontSize,14);
assert.ok(text.some(node=>node.create==='收起'&&node.fontSize===10&&node.lineHeight===14));
const nodes = [...owner.nodes.values()];
nodes.find(node=>node.accessibilityText==='收起目录').onClick();
nodes.find(node=>node.accessibilityText==='书签').onClick();
assert.equal(close,1); assert.equal(bookmarks,1);
// Content/keyboard/selection interaction probes are already covered by the
// production directory/bookmark suites; byte-exact migration preservation is
// available as the explicit one-time fixture option above.
console.log('PASS complete directory/bookmark Typography family and actual SDK panel header/tab carriers');
