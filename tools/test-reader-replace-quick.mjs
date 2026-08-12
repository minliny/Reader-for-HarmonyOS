import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createReaderReplaceQuickState,
  replaceConfirmedReaderReplaceRule,
} from '../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts';

function rule(id, order, name = `规则 ${id}`, isEnabled = true) {
  return {
    id,
    name,
    pattern: `模式 ${id}`,
    replacement: `替换 ${id}`,
    scopeTitle: false,
    scopeContent: true,
    isEnabled,
    isRegex: false,
    timeoutMillisecond: 3000,
    order,
  };
}

const empty = createReaderReplaceQuickState([]);
assert.deepEqual(empty, {
  kind: 'ready',
  rules: [],
  previewAvailable: false,
  fullManagementAvailable: false,
});
const single = createReaderReplaceQuickState([rule(1, 1)]);
assert.equal(single.kind, 'ready');
assert.deepEqual(single.rules.map((entry) => entry.id), [1]);
const pair = createReaderReplaceQuickState([rule(2, 20), rule(1, 10)]);
assert.equal(pair.kind, 'ready');
assert.deepEqual(pair.rules.map((entry) => entry.id), [1, 2]);
const unnamed = createReaderReplaceQuickState([
  rule(1, 1),
  rule(2, 2, '   '),
  rule(3, 3),
]);
assert.equal(unnamed.kind, 'ready', 'a real rule is not discarded only because its name is blank');
assert.deepEqual(unnamed.rules.map((entry) => entry.id), [1, 2, 3]);

const sourceRules = [rule(4, 40), rule(2, 20), rule(1, 10), rule(5, 50), rule(3, 30)];
const ready = createReaderReplaceQuickState(sourceRules);
assert.equal(ready.kind, 'ready');
assert.deepEqual(ready.rules.map((entry) => entry.id), [1, 2, 3],
  'Quick Replace must expose only the first three canonical order/id rows');
assert.equal(ready.previewAvailable, false);
assert.equal(ready.fullManagementAvailable, false);
assert.deepEqual(sourceRules.map((entry) => entry.id), [4, 2, 1, 5, 3],
  'state derivation must not reorder the Core-owned input array');

const confirmed = { ...ready.rules[1], isEnabled: false };
const updated = replaceConfirmedReaderReplaceRule(ready, confirmed);
assert.equal(updated.kind, 'ready');
assert.equal(updated.rules[1].isEnabled, false);
assert.equal(ready.rules[1].isEnabled, true, 'confirmed transition must remain immutable');
assert.strictEqual(replaceConfirmedReaderReplaceRule(ready, rule(99, 99)), ready,
  'a mismatched confirmed identity must not mutate visible state');

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const panel = await readFile(new URL('ReaderReplaceQuickPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderReplaceQuickGateway.ts', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

assert.match(panel, /Phone `942:54` \/ `912:68`/);
assert.match(panel, /Tablet `942:56` \/ `914:64`/);
assert.match(panel, /if \(this\.state\.kind === 'ready'\)/,
  'non-ready states must render no invented visual');
assert.match(panel, /\.width\(this\.panelWidth\(\)\)[\s\S]*\.height\(REPLACE_PANEL_HEIGHT\)/);
assert.match(panel, /REPLACE_PANEL_WIDTH_PHONE = 286/);
assert.match(panel, /REPLACE_PANEL_WIDTH_TABLET = 262/);
assert.match(panel, /\.height\(REPLACE_RULES_VIEWPORT_HEIGHT\)[\s\S]*\.clip\(true\)/,
  'the bounded three-row viewport must retain the source geometry');
assert.match(panel, /if \(this\.state\.rules\.length === 0\) \{[\s\S]*Text\('暂无替换规则'\)/,
  'a valid empty Core list must render the minimum visible empty state');
assert.match(panel, /REPLACE_PREVIEW_WIDTH_PHONE = 97\.59/);
assert.match(panel, /REPLACE_PREVIEW_WIDTH_TABLET = 88/);
assert.match(panel, /return this\.contentWidth\(\) - REPLACE_RULE_BODY_PADDING_X \* 2 - REPLACE_FOOTER_BUTTON_GAP -[\s\S]*this\.previewButtonWidth\(\)/);
assert.match(panel, /app\.media\.reader_replace_close/);
assert.match(panel, /app\.media\.reader_replace_preview/);
assert.match(panel, /app\.media\.reader_replace_manage/);
assert.match(panel, /\.enabled\(kind === 'management'\)/,
  'Preview must remain fail-closed while the existing management page is reachable');
assert.match(panel, /Text\(kind === 'preview' \? '预览效果' : '完整管理'\)/,
  'deferred Preview and Full-management entries must remain visible');
assert.match(panel, /打开完整替换规则管理/,
  'Full management must be described as the existing reachable capability');
assert.match(panel, /onOpenManagement\(\)/,
  'the reader entry must delegate navigation instead of creating another management page');
assert.doesNotMatch(panel, /完整替换页尚未提供/);
assert.doesNotMatch(panel, /雨容称呼|旧称统一|标点清理|广告过滤/,
  'Figma sample copy must not become business rule data');

const listRequest = gateway.indexOf("request('replace-rule.list', {})");
const persistRequest = gateway.indexOf("request('replace.persist'");
assert.ok(listRequest >= 0, 'Quick Replace must list canonical Core rules');
assert.ok(persistRequest >= 0, 'Quick Replace must persist toggles through the UI transaction command');
assert.match(gateway, /operation: 'update',[\s\S]*id: ruleId,[\s\S]*isEnabled/);
assert.match(gateway, /rule\.id !== ruleId \|\| rule\.isEnabled !== isEnabled/,
  'the confirmed update identity and state must be validated');
assert.doesNotMatch(gateway, /request\('replace\.apply'/,
  'processed chapter text must not be sent through replacement a second time');
assert.doesNotMatch(gateway, /replace-rule\.update/,
  'toggle mutations must retain replace.persist undo/persistence semantics');
assert.doesNotMatch(gateway, /ReaderRuntimeOwner|\.current\(\)/,
  'Quick Replace must receive the existing Core runtime instead of locating a global owner');
assert.match(gateway, /constructor\(runtimeOwner: ReadingGatewayRuntime\)/,
  'Quick Replace runtime injection must remain a required dependency');

assert.match(experience, /private replacePanelGeneration: number = 0/,
  'panel continuations need their own generation');
assert.match(experience, /private replaceMutationGeneration: number = 0/,
  'persisted mutations need a generation independent from the panel');
assert.match(experience, /private openRulesManagement\(\): void/);
assert.match(experience, /this\.onOpenRulesManagement\(\)/);
assert.doesNotMatch(experience, /replaceMutationInFlight/,
  'panel close must not release a shared in-flight boolean');

const setControlPage = experience.match(
  /private setControlPage\(page: ReaderControlPage\): void \{([\s\S]*?)\n  private hideControl/,
);
assert.ok(setControlPage, 'setControlPage owner path must exist');
assert.match(setControlPage[1], /replacePanelGeneration \+= 1/);
assert.doesNotMatch(setControlPage[1], /finishReplaceMutation|invalidateReplaceMutationOwner/,
  'closing Quick Replace must invalidate only panel presentation work');

const hideControl = experience.match(/private hideControl\(\): void \{([\s\S]*?)\n  private openQuickReplace/);
assert.ok(hideControl, 'hideControl owner path must exist');
assert.match(hideControl[1], /replacePanelGeneration \+= 1/);
assert.doesNotMatch(hideControl[1], /finishReplaceMutation|invalidateReplaceMutationOwner/,
  'hiding controls must not cancel an accepted Core mutation');

const toggleOwner = experience.match(
  /private toggleQuickReplaceRule\([\s\S]*?\n  private beginReplaceMutation/,
);
assert.ok(toggleOwner, 'Quick Replace mutation owner path must exist');
assert.match(toggleOwner[0], /const mutationGeneration = this\.beginReplaceMutation\(lifecycleToken, bookId, ruleId\)/);
assert.match(toggleOwner[0], /this\.isReplaceMutationCurrent\(mutationGeneration, lifecycleToken, bookId, ruleId\)/,
  'a success response must retain original session, book, rule, and mutation identity');
assert.match(toggleOwner[0],
  /if \(panelGeneration === this\.replacePanelGeneration[\s\S]*?this\.replaceState = [\s\S]*?\n        \}[\s\S]*?this\.finishReplaceMutation[\s\S]*?this\.reloadCurrentPageAfterReplacePersist\(lifecycleToken, bookId\)/,
  'successful Core closure must reload content outside the panel-visibility gate');
const failureOwner = toggleOwner[0].match(/\.catch\(\(_error: Error\): void => \{([\s\S]*?)\n      \}\);/);
assert.ok(failureOwner, 'Quick Replace failure owner path must exist');
assert.match(failureOwner[1], /finishReplaceMutation/);
assert.doesNotMatch(failureOwner[1], /reloadCurrentPageAfterReplacePersist|invalidateBook|contentMetrics/,
  'a failed persist must release its owner without refreshing content');

const beginMutation = experience.match(
  /private beginReplaceMutation\([\s\S]*?\n  private isReplaceMutationCurrent/,
);
assert.ok(beginMutation, 'replace mutation admission path must exist');
assert.match(beginMutation[0], /replaceMutationActiveLifecycleToken === lifecycleToken/);
assert.match(beginMutation[0], /replaceMutationActiveBookId === bookId/);
assert.match(beginMutation[0], /return -1/,
  'reopening the panel must not admit another mutation for the same book/session');

const currentMutation = experience.match(
  /private isReplaceMutationCurrent\([\s\S]*?\n  private finishReplaceMutation/,
);
assert.ok(currentMutation, 'replace mutation response guard must exist');
assert.match(currentMutation[0], /this\.isSessionActive\(lifecycleToken\) && this\.bookId === bookId/);
assert.match(currentMutation[0], /ruleId === this\.replaceMutationActiveRuleId/,
  'an old book/session/rule response must not own the current reader');

const reloadOwner = experience.match(
  /private reloadCurrentPageAfterReplacePersist\(lifecycleToken: number, bookId: string\): void \{([\s\S]*?)\n  private refreshReaderBrightness/,
);
assert.ok(reloadOwner, 'post-persist reload owner path must exist');
assert.match(reloadOwner[1], /!this\.isSessionActive\(lifecycleToken\) \|\| this\.bookId !== bookId/);
assert.match(reloadOwner[1], /this\.contentMetrics = undefined/);
assert.match(reloadOwner[1], /this\.paginationIndex\.invalidateBook\(this\.sourceId, this\.bookId\)/);
assert.match(reloadOwner[1], /this\.selectChapterAnchor\(chapter\.chapterIndex, page\.startScalar, false\)/);
assert.doesNotMatch(reloadOwner[1], /this\.phase !== 'ready'/,
  'a page turn racing persist success must not skip metric invalidation and reload');
assert.ok(reloadOwner[1].indexOf('this.contentMetrics = undefined') <
  reloadOwner[1].indexOf('if (chapter === undefined || page === undefined)'),
  'processed metrics and pagination must be invalidated before any missing-page early return');

console.log('reader Quick Replace pure/static contract: PASS');
