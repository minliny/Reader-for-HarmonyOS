import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
const selected = selectContractCases({
  'pending-prefix': { description: 'Actual SDK control-directory pending prefix remains in the existing list flow, with current input, original generation and presentation fences', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
for (const id of selected) {
  const sdk = boundedSurfaceSdk(), calls = [];
  const reading = sdk.consumer(read('features/reading/ui/LocalReadingExperience.ets'),
    ['bookmarkRecoveryIdentity', 'reconcileBookmarkRecovery']);
  const recovery = { presentationId: 'book-a-presentation', bookmarks: { visible: true, canRetry: true,
    generation: 8, message: '原操作结果尚未确认，请核对同一原操作' }, bookmarksKind: 'pending',
    bookmarksBusy: false, canContinueBookmarks: true };
  Object.assign(reading, { lifecycleToken: 7, bookmarkRecovery: recovery,
    isSessionActive: () => true, isControlInputEnabled: () => true,
    onReconcileBookmarks: (generation, presentation) => calls.push(['query', generation, presentation]),
    onContinueBookmarks: (generation, presentation) => calls.push(['continue', generation, presentation]) });
  const source = read('features/reading/ui/ReaderControlDirectoryContent.ets');
  const names = ['directoryPrefix', 'hasBookmarkRecovery', 'bookmarkWriteEnabled', 'headerCount', 'prefixIdentity',
    'onBookmarkRecoveryChanged', 'reconcileBookmarkRecovery', 'prefixHeight', 'onPrefixArea', 'currentContent', 'currentInputEnabled'];
  const owner = sdk.consumer(source, names);
  let input = true;
  Object.assign(owner, { mounted: true, layoutPresentation: 3, sessionKey: 'current-directory', tab: 'directory',
    shortContent: false, prefixMeasuredHeight: 0, prefixRevealRevision: 0, interactionEnabled: true,
    inputCurrent: () => input, rowWidth: () => 286, shortHeaderHeight: () => 140,
    bookmarkRecovery: recovery, bookmarkRecoveryIdentity: reading.bookmarkRecoveryIdentity(),
    onBookmarkRecovery: (identity, continuing) => reading.reconcileBookmarkRecovery(identity, continuing) });
  assert.equal(owner.headerCount(), 1);
  assert.equal(owner.bookmarkWriteEnabled(), false, 'unknown original blocks only new bookmark writes');
  owner.directoryPrefix(); sdk.properties.flush();
  assert.equal(sdk.nodes(owner).filter(node => node.type === 'Scroll').length, 0, 'pending surface adds no second scroll owner');
  const action = label => {
    const child = sdk.walk(owner).find(node => node instanceof sdk.deps.ReaderRecoveryAction && node.label === label);
    assert.ok(child); return [...child.nodes.values()].find(node => node.type === 'Button' && node.onClick);
  };
  const query = action('重新载入核对书签'), continuation = action('继续原操作');
  query.onClick(); continuation.onClick();
  assert.deepEqual(calls, [['query', 8, 'book-a-presentation'], ['continue', 8, 'book-a-presentation']]);
  input = false; query.onClick(); assert.equal(calls.length, 2, 'retained actor rejects retired parent input lease'); input = true;
  owner.bookmarkRecovery = { ...recovery, bookmarksBusy: true }; query.onClick(); assert.equal(calls.length, 2);
  owner.bookmarkRecovery = recovery;
  owner.layoutPresentation = 4; query.onClick(); assert.equal(calls.length, 2, 'retired directory layout callback cannot borrow current owner');
  owner.layoutPresentation = 3;
  owner.bookmarkRecoveryIdentity = 'successor'; query.onClick(); assert.equal(calls.length, 2);
  owner.bookmarkRecoveryIdentity = reading.bookmarkRecoveryIdentity();
  reading.bookmarkRecovery = { ...recovery, presentationId: 'book-b-presentation' }; query.onClick(); assert.equal(calls.length, 2, 'outer reading scope remains a second fence');
  reading.bookmarkRecovery = recovery;
  const prefix = [...owner.nodes.values()].find(node => node.type === 'Column' && node.onAreaChange);
  prefix.onAreaChange({}, { width: 286, height: 216 });
  assert.equal(owner.prefixHeight(), 216, 'natural flow measurement can grow above its first-frame minimum');
  owner.bookmarkRecovery = { ...recovery, bookmarks: { ...recovery.bookmarks, visible: false }, bookmarksKind: 'none' };
  owner.onBookmarkRecoveryChanged(); assert.equal(owner.headerCount(), 0); assert.equal(owner.bookmarkWriteEnabled(), true);
  prefix.onAreaChange({}, { width: 286, height: 900 }); assert.equal(owner.prefixMeasuredHeight, 0, 'retired prefix area cannot overwrite current facts');
  assert.match(source, /ListItem\(\) \{ this\.directoryPrefix\(\); \}\.width\('100%'\)\.constraintSize\(\{ minHeight: this\.prefixHeight\(\) \}\)/);
  assert.match(source, /prefixBuilder: \(\): void => \{ this\.directoryPrefix\(\); \}/);
  console.log('PASS control-directory current-book original recovery prefix and actual action actors; no native execution');
  recordContractCasePass(id);
}
