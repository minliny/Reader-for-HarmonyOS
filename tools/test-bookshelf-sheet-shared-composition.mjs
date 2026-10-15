import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/bookshelf/BookshelfBookActionSheet.ets');
const actionsSource = read('features/common/ReaderSheetActionList.ets');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/bookshelf-sheet-shared-baseline.json', import.meta.url)));
assert.equal(createHash('sha256').update(baseline.source).digest('hex'), baseline.sha256);

function open(id = 'opening:1', options = {}, extra = {}) {
  const p = boundedSurfaceSdk(options);
  p.hooks.lifecycleChildren = true;
  p.hooks.childSources.ReaderSheetActionList = actionsSource;
  p.deps.ReaderSheetActionList = createReaderBuilderProbe(actionsSource, boundedMembers(actionsSource), p.deps, p.hooks).Component;
  const calls = [];
  const input = options.leafSource ?? source;
  const owner = p.consumer(input, boundedMembers(input), {}, { presentationId: id,
    isCurrent: candidate => candidate === id,
    onMultiSelect: () => calls.push('select'), onBookInfo: () => calls.push('info'),
    onEditGroup: () => calls.push('group'), onRemoveFromBookshelf: () => calls.push('remove'), ...extra });
  owner.initialRender();
  const actionOwner = p.walk(owner).find(child => child instanceof p.deps.ReaderSheetActionList);
  const content = p.walk(owner).find(child => child instanceof p.deps.ReaderActionSheetContent);
  const frame = p.walk(owner).find(child => child instanceof p.deps.ReaderBoundedSurface);
  const header = p.walk(owner).find(child => child instanceof p.deps.ReaderBoundedSurfaceHeader);
  return { p, owner, actionOwner, frame, header, calls,
    content,
    buttons: () => p.walk(actionOwner).flatMap(child => [...child.nodes.values()]).filter(node => node.onClick) };
}
const physical = node => Object.fromEntries(Object.entries(node).filter(([key, value]) => key !== 'id' && key !== 'onClick' && typeof value !== 'function'));

for (const scheme of ['day', 'night']) {
  const next = open();
  for (const child of next.p.walk(next.owner)) if ('appThemeScheme' in child) child.appThemeScheme = scheme;
  next.p.properties.flush();
  const original = next.p.consumer(baseline.source);
  original.appThemeScheme = scheme; original.initialRender();
  const oldNodes = [...original.nodes.values()];
  const nextNodes = [...next.frame.nodes.values(), ...next.header.nodes.values()]
    .filter(node => node.type !== 'If' && node.type !== 'ForEach');
  assert.deepEqual(nextNodes.map(physical), oldNodes.slice(0, 4).map(physical), `${scheme}: shared frame/header retain the existing host geometry`);
  const contentNodes = next.p.walk(next.content).flatMap(child => [...child.nodes.values()]);
  for (const label of ['多选', '书籍信息', '编辑分组', '移除书架']) {
    assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === label), `${scheme}: shared content renders ${label}`);
  }
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '多选' && node.fontColor === readerAppColor('TOK_INK', scheme)),
    `${scheme}: ordinary action keeps the current theme ink`);
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '移除后可在书籍详情中重新加入' && node.fontColor === readerAppColor('TOK_MUTED', scheme)),
    `${scheme}: secondary state keeps the current theme muted role`);
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '移除书架' && node.fontColor === readerAppColor('TOK_DOWNLOAD_DANGER', scheme)),
    `${scheme}: danger action keeps the shared danger role`);
  assert.equal(next.p.walk(next.owner).filter(child => child instanceof next.p.deps.ReaderBoundedSurface).length, 1);
}
for (const [index, action] of ['select', 'info', 'group', 'remove'].entries()) {
  const opened = open(); opened.buttons()[index].onClick();
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [action], 'all four operations are exclusive and claimed before dispatch');
}
{
  const opened = open(); const oldButtons = opened.buttons();
  opened.actionOwner.updateStateVars({ presentationId: 'opening:2' });
  opened.actionOwner.isCurrent = id => id === 'opening:2';
  opened.p.properties.flush();
  for (const button of oldButtons) button.onClick();
  assert.deepEqual(opened.calls, [], 'captured old physical handlers cannot dispatch to replacement opening');
  const fresh = opened.buttons().filter(button => !oldButtons.includes(button));
  assert.equal(fresh.length, 4); fresh[1].onClick();
  assert.deepEqual(opened.calls, ['info']);
  opened.actionOwner.aboutToDisappear(); fresh[2].onClick();
  assert.deepEqual(opened.calls, ['info']);
}
for (const isCurrent of [() => false, () => { throw Error('owner retired'); }]) {
  const opened = open('opening:1', {}, { isCurrent });
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [], 'retired or unavailable identity refuses all actions');
}
{
  const opened = open('opening:1', {}, { onBookInfo: () => { throw Error('actual business failure'); } });
  assert.throws(() => opened.buttons()[1].onClick(), /actual business failure/);
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [], 'business failure is not swallowed or replayed');
  const blank = open(''); for (const button of blank.buttons()) button.onClick(); assert.deepEqual(blank.calls, []);
}
assert.throws(() => {
  const bad = open('opening:1', { leafSource: source.replace('actions: (): void => { this.sheetActions(); }', 'actions: this.sheetActions') });
  assert.equal(bad.actionOwner.presentationId, 'opening:1', 'direct Builder reference loses the business receiver');
}, /opening:1/);
const frameSource = read('features/common/ReaderBoundedSurface.ets');
const changedFrame = frameSource.replace("instance.width('100%').height(spec.height)", "instance.width('100%').height(spec.height + 1)");
assert.notEqual(frameSource, changedFrame);
const changed = open('opening:1', { ReaderBoundedSurface: changedFrame });
assert.equal([...changed.frame.nodes.values()].find(node => node.type === 'Stack').height, 271);
const tts = changed.p.consumer(read('features/reading/ReaderTtsConfigOverlay.ets'), undefined,
  { KeyboardAvoidMode: { RESIZE: 1 }, InputType: { Password: 'password' }, readerOnlineTtsProfile: () => ({ voice: '', format: 'mp3' }) },
  { manager: true, windowModal: true, selectionId: 'tts:1', availableWidth: 338, availableHeight: 666 });
tts.initialRender();
const ttsFrame = changed.p.walk(tts).find(child => child instanceof changed.p.deps.ReaderBoundedSurface);
assert.equal([...ttsFrame.nodes.values()].find(node => node.type === 'Column').height, tts.panelHeight(), 'sheet-only variant change cannot alter TTS geometry');
console.log('bookshelf shared Sheet PASS: real SDK leaf→Frame/Header/keyed ActionList→quick content, retained host geometry and live day/night roles, four operations/once-only dispatch, stale handlers/reopen/retirement/faults, lexical binding and variant isolation; native dismiss/focus/layout remains OPEN');
