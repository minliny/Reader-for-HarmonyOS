import { themeDayDesignSource } from './lib/reader-theme-design-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Structural wiring checks only. These do not claim ArkTS compilation, touch,
// first-frame ordering, or visual parity; production policy executes separately.
const read = (path) => themeDayDesignSource(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const content = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const panel = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');

assert.match(content, /@Prop embeddedInControl: boolean = false;/,
  'standalone Detail directory keeps its existing shell by default');
assert.match(content, /@Prop @Watch\('onMotionProgressChanged'\) motionProgress: number = 1;/);
assert.match(content, /if \(this\.embeddedInControl\) \{\s*this\.embeddedBody\(\);\s*\} else \{\s*this\.standalonePanel\(\);/);
assert.equal((content.match(/ReaderDirectoryList\(\{/g) ?? []).length, 1,
  'one directory list declaration is shared across Quick and Full');
assert.match(content, /private chapterList\(\) \{[\s\S]*?Stack\(\{ alignContent: Alignment.TopStart \}\) \{\s*Column\(\)/,
  'the short Quick List must align to the top of the retained Full-height actor, not below the Quick clip');
// Phone mount: Full content 666, Quick content 190; row origin 48.
// Default center would add (617 - 117)/2 = 250 and hide all Quick rows.
assert.ok(48 + (666 - 48 - 1 - 117) / 2 > 190);
assert.ok(48 + 117 <= 190, 'top-aligned Quick rows fit inside the authored clip');
assert.match(content, /@State private admittedEntries:/,
  'footer title/position must subscribe to admitted TOC changes after hidden mount');
assert.match(content, /\.height\(this\.bookmarkBodyViewportHeight\(\)\)/,
  'bookmark empty/loading/error states must center inside the visible viewport');
assert.match(content, /if \(this.activeTab === 'bookmarks'\) \{\s*Stack\(\{ alignContent: Alignment.TopStart \}\)/,
  'short bookmark body cannot be centered in the Full mount box');
assert.equal((content.match(/ReaderBookmarkList\(\{/g) ?? []).length, 1,
  'one bookmark list declaration is shared across Quick and Full');
assert.doesNotMatch(content, /(?:if|else if)\s*\(this\.motionProgress\s*[<>=]/,
  'motion progress must not select a different subtree');
assert.doesNotMatch(content, /\.scale\(/, 'real text/list layout is never scaled as an image');
assert.doesNotMatch(content, /animateTo\(|\.animation\(/,
  'the content consumes the shared progress instead of starting an actor clock');
assert.match(content, /controlValue\(32, 40\)/,
  'all directory rows use the same restored row-height endpoints');
assert.match(content, /rowHeight: this\.directoryListRowHeight\(\)/,
  'the virtual List receives a stable row height during intermediate morph frames');
assert.match(content, /private directoryListRowHeight\(\): number/);
assert.match(content, /controlValue\(286, 338\)/);
assert.match(content, /controlValue\(190, 666\)/);
assert.match(content, /controlValue\(127, 160\)/);
assert.match(content, /controlValue\(31, 36\)/);
assert.match(content, /controlValue\(48, 99\)/,
  'the entire real List moves from the restored Quick row origin to Full');

// Actual source hierarchy, not a new collision-avoidance mask. The live
// structure has local ToolbarDivider y=51 under Toolbar y=43. Raw motion
// independently adds 12->0 and 18->0 translations and 0->1 opacity to each.
// Keep contract inputs inside tools/fixtures so the HAP controller snapshot
// captures them. The independent fixture preserves both original responses
// and the raw receipt SHA; the raw evidence file is not a runtime dependency.
const hierarchyFixture = JSON.parse(read(
  'tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json'));
assert.equal(hierarchyFixture.sourceRequests[0].fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.deepEqual(hierarchyFixture.sourceRequests.map((request) => request.nodeId),
  ['1689:2121', '1689:1616']);
assert.match(hierarchyFixture.rawReceipt.sha256, /^[0-9a-f]{64}$/);
const liveCode = hierarchyFixture.responses[0].content.find((block) =>
  block.type === 'text' && block.text.includes('export default function ContentViewportDirectory')).text;
const liveToolbar = liveCode.slice(liveCode.indexOf('<motion.div className="absolute h-[52px]'),
  liveCode.indexOf('<motion.div className="absolute bg-[var(--reader-control-panel-soft',
    liveCode.indexOf('data-node-id="1689:2137"')));
assert.match(liveToolbar, /top-\[43px\][^\n]*data-node-id="1689:2125"/);
assert.match(liveToolbar, /top-\[51px\][^\n]*data-node-id="1689:2137"/);
assert.doesNotMatch(liveToolbar, /mask|z-index/);
const motionFixture = JSON.parse(read('tools/fixtures/reader-control-restored-baseline-20260905.json'));
const directoryMotion = motionFixture.records.find((record) =>
  record.module === 'directory' && record.direction === 'expand').motionContext.nodes;
for (const [nodeId, localTranslation] of [['1689:2125', 18], ['1689:2137', 12]]) {
  const css = directoryMotion.find((node) => node.nodeId === nodeId).codeSnippets.css;
  assert.ok(css.includes(`translate: 0px ${localTranslation}px;`));
  assert.match(css, /100% \{ translate: 0px 0px; \}/);
  assert.match(css, /0% \{ opacity: 0; \}/);
  assert.match(css, /100% \{ opacity: 1; \}/);
}

function toolbarHierarchy(source) {
  const match = source.match(/Stack\(\{ alignContent: Alignment\.TopStart \}\) \{\s*this\.searchControls\(\);[\s\S]*?Text\(''\)\s*\.width\(Math\.max\(0, this\.panelWidth\(\) - 2\)\)\s*\.height\(1\)\s*\.backgroundColor\(TOK_LINE\)\s*\.position\(\{ x: 0, y: this\.controlValue\((\d+), (\d+)\) \}\)\s*\.opacity\(this\.controlProgress\(\)\);\s*\}\s*\.width\(Math\.max\(0, this\.panelWidth\(\) - 2\)\)\s*\.height\(52\)\s*\.position\(\{ x: 1, y: this\.controlValue\((\d+), (\d+)\) \}\)\s*\.opacity\(this\.controlProgress\(\)\)/);
  assert.ok(match, 'divider must inherit the actual Toolbar parent, not a flattened sibling formula');
  return match.slice(1).map(Number);
}
const [childQuick, childFull, parentQuick, parentFull] = toolbarHierarchy(content);
assert.deepEqual([childQuick, childFull, parentQuick, parentFull], [63, 51, 61, 43]);
assert.doesNotMatch(content, /controlValue\(107, 95\)/,
  'the flattened divider path must not coexist with the nested actor');
assert.throws(() => toolbarHierarchy(content.replace(
  '.position({ x: 0, y: this.controlValue(63, 51) })',
  '.position({ x: 1, y: this.controlValue(107, 95) })')),
  /actual Toolbar parent/, 'reject restoring the old sibling-space coordinates');
assert.throws(() => toolbarHierarchy(content.replace(
  '.position({ x: 1, y: this.controlValue(61, 43) })\n      .opacity(this.controlProgress())',
  '.position({ x: 1, y: this.controlValue(61, 43) })\n      .opacity(1)')),
  /actual Toolbar parent/, 'reject dropping inherited opacity');

// Execute the production interpolation method bodies. The sum/product below
// checks nested coordinate/alpha semantics, not ArkUI pixel compositing.
function productionMethod(name, parameters) {
  const body = content.match(new RegExp('private ' + name + '\\([^]*?\\): number \\{([^]*?)\\n  \\}'))?.[1];
  assert.ok(body, `missing production method ${name}`);
  return new Function(...parameters, body);
}
const sampler = {
  motionProgress: 0,
  controlProgress: productionMethod('controlProgress', []),
  controlValue: productionMethod('controlValue', ['quick', 'full']),
};
for (const [p, expectedY, expectedAlpha] of [[0, 124, 0], [0.25, 116.5, 0.0625],
  [0.5, 109, 0.25], [0.75, 101.5, 0.5625], [1, 94, 1]]) {
  sampler.motionProgress = p;
  assert.equal(sampler.controlValue(parentQuick, parentFull) + sampler.controlValue(childQuick, childFull),
    expectedY, `divider composed y at p=${p}`);
  assert.equal(sampler.controlProgress() * sampler.controlProgress(), expectedAlpha,
    `divider inherits parent alpha at p=${p}`);
}
assert.match(content, /this\.rebuildProjection\(nextTab, this\.ascending, this\.searchQuery\);\s*this\.beginListPositioning\(nextTab\);\s*this\.onTabChange\(nextTab\);/);
assert.match(content, /beginReaderControlListOpen\(this\.listPositioning, `\$\{sessionKey\}:\$\{tab\}`, ordinal\)/);
assert.equal((content.match(/onViewportChanged:/g) ?? []).length, 2);
assert.equal((content.match(/onUserScrollIntent:/g) ?? []).length, 2);
assert.match(content, /prepareReaderControlListPosition\(this\.listPositioning, openRevision/);
assert.match(content, /readerControlListPositionIsCurrent\(this\.listPositioning, command\)/);
assert.match(content, /commitReaderControlListPosition\(this\.listPositioning, command\)/);
assert.match(content, /private onListUserScroll\(\): void \{\s*this\.listPositioning = markReaderControlListUserScrolled/);
assert.match(content, /this\.listPositioning = commitReaderControlListPosition[\s\S]*?this\.initialListPositionReady = true;/,
  'initial positioning still commits a single safe scroll before enabling list input');
assert.match(content, /onFirstLayout: \(\): void => this\.onListFirstLayout\(\)/,
  'first native layout must be able to kick positioning even when an ancestor is clipped');
assert.match(content, /\.opacity\(this\.projectedEntries\.length > 0 \? 1 : 0\)/,
  'persistent chapter actors stay painted while positioning is pending');
assert.match(content, /\.opacity\(this\.projectedBookmarks\.length > 0 \? 1 : 0\)/,
  'persistent bookmark actors stay painted while positioning is pending');
assert.match(content, /private onEntriesChanged\(\): void \{[\s\S]*?this\.pendingEntries = snapshotReaderDirectoryData\(this\.entries\);\s*this\.scheduleDeferredMutationFlush\(\);/,
  'entries changes are queued outside the ArkUI render callback');
assert.match(content, /const sourceEntries = this\.admittedEntries;/,
  'projection must consume the admitted snapshot, not the transient hidden empty sentinel');
assert.doesNotMatch(content, /projectionMountPrimary|this\.projectionMountPrimary/,
  'the directory List remains one persistent native actor');
assert.match(content, /@Prop @Watch\('onListSessionKeyChanged'\) listSessionKey: string = '';/,
  'persistent directory slot watches each control opening session');
assert.match(content, /private onListSessionKeyChanged\(\): void \{[\s\S]*?this\.deferredSessionKey = this\.listSessionKey;\s*this\.scheduleDeferredMutationFlush\(\);/,
  'reopen session keys are queued outside the ArkUI render callback');
assert.match(content, /private onReadingAnchorChanged\(\): void \{[\s\S]*?this\.deferredReadingAnchor = true;\s*this\.scheduleDeferredMutationFlush\(\);/,
  'reading-anchor changes are queued outside the ArkUI render callback');
assert.match(content, /private motionActive: boolean = false;[\s\S]*?private pendingEntries: LocalReadingTocEntry\[\] \| undefined = undefined;/,
  'business-data refreshes have an explicit pending slot during active motion');
assert.match(content, /private deferredMutationGeneration: number = 0;[\s\S]*?private deferredFlushScheduled: boolean = false;/,
  'watch updates share a generation-guarded deferred flush');
assert.match(content, /private scheduleDeferredMutationFlush\(\): void \{[\s\S]*?this\.deferredMutationGeneration \+= 1;[\s\S]*?setTimeout\(\(\): void => \{/,
  'deferred flush uses a next-turn callback and mutation generation');
assert.match(content, /private flushDeferredMutations\(\): void \{[\s\S]*?if \(nextMotionActive\) return;[\s\S]*?this\.rebuildProjection\(/,
  'queued business changes wait for the motion endpoint and rebuild once');
const motionHandler = content.match(/private onMotionProgressChanged\(\): void \{([\s\S]*?)\n  \/\*\*/)?.[1];
assert.ok(motionHandler);
for (const [name, body] of [
  ['entries', content.match(/private onEntriesChanged\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? ''],
  ['session', content.match(/private onListSessionKeyChanged\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? ''],
  ['anchor', content.match(/private onReadingAnchorChanged\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? ''],
  ['motion', motionHandler],
]) {
  assert.doesNotMatch(body, /activeTab\s*=|projectedEntries\s*=|projectedBookmarks\s*=|bookmarkTabLoading\s*=|initialListPositionReady\s*=|rebuildProjection|beginListPositioning|commitEntriesSnapshot/,
    `${name} watch callback cannot write @State or rebuild the native list synchronously`);
}
assert.match(motionHandler, /leadingRowAnchor/,
  'row-height morph preserves the leading real row instead of drifting to a different chapter');
assert.match(motionHandler, /positioningTab === 'directory' && progress > 0 && progress < 1\)/,
  'intermediate morph frames do not trigger AceList extent recalculation');
assert.match(content, /rowHeight: this\.directoryListRowHeight\(\)/);
assert.match(content, /height\(this\.directoryListViewportHeight\(\)\)/,
  'List viewport stays at a settled endpoint while outer Stack clips the morph');
assert.match(content, /listPaddingX: this\.directoryListPaddingX\(\)/,
  'List padding stays stable during the morph');
assert.match(content, /@Prop quickListWidth: number = 286;/);
assert.match(content, /@Prop fullListWidth: number = 338;/);
assert.match(content, /@Prop quickListHeight: number = 141;/);
assert.match(content, /@Prop fullListHeight: number = 518;/);
assert.doesNotMatch(content, /return progress >= 1 \? 518 : 141/,
  'endpoint dimensions are supplied by the parent, not hard-coded in the sampler');
assert.match(panel, /ReaderControlDirectoryContent\(\{/);
assert.match(panel, /availableWidth: this\.contentMotionWidth, availableHeight: this\.contentMotionHeight/);
assert.match(panel, /this\.layout\.dockBottomGap, this\.controlQuickHeight\(\)/,
  'Stage receives the same responsive Quick endpoint used by directory sizing');
assert.match(panel, /private controlQuickHeight\(\): number/);
console.log('reader control directory content: structural wiring passed (not runtime or visual evidence)');
