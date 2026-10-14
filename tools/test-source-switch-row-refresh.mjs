import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { sourceSwitchRowSdk } from './lib/source-switch-row-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { sourceSwitchNovelChapter, sourceSwitchNovelLatency } from '../entry/src/main/ets/features/source/SourceSwitchNovelPresentation.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url), 'utf8');
const properties = createArkUIPropertyRuntimeProbe();
const rows = sourceSwitchRowSdk(properties, source);
const transition = { animation() { return this; } };
const deps = { ...properties.sdk, SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU,
  ...rows, ...readerTypographyRoles, SOURCE_SWITCH_VISUAL, sourceSwitchNovelChapter, sourceSwitchNovelLatency,
  TouchType: { Down: 0, Up: 1, Move: 2, Cancel: 3 },
  TransitionEffect: { IDENTITY: transition, OPACITY: transition },
  ColorMetrics: { resourceColor: () => ({ red: 1, green: 2, blue: 3, alpha: 255 }), rgba: (...values) => ({ color: values }) },
  curves: { cubicBezierCurve: (...values) => values } };
const candidate = (sourceId, latencyMs, chapter, extra = {}) => ({ sourceId, bookUrl: `/book/${sourceId}`,
  sourceName: `书源 ${sourceId}`, bookName: '大明望族', author: '雁九', category: 'novel',
  latestChapterTitle: chapter, latencyKind: 'search', latencyMs, acquisitionState: 'discovered', ...extra });
const visible = owner => [...owner.nodes.values()];
const hit = owner => visible(owner).find(value => value.type === 'Row' && value.onClick);
const text = (owner, value) => visible(owner).find(node => node.type === 'Text' && node.create === value);

// Negative control: compile the same production consumer with its historical
// one-way @Prop declaration. An explicit native CHANGE/range request retains
// this same-key child and does not call its parent updateStateVars/reset.
// Native LazyForEach scheduling itself is outside this property/observer probe.
const legacySource = source
  .replace(/\s*@ObjectLink @Watch\('rowChanged'\) row: SourceSwitchCandidateRow;/, '')
  .replace('@State private candidate: SourceSwitchCandidate = this.row.candidate;', '@Prop candidate: SourceSwitchCandidate;')
  .replace(/\s*private rowChanged\(\): void\s*\{\s*this\.candidate = this\.row\.candidate;\s*\}/, '')
  .replace(/this\.row\.candidate/g, 'this.candidate');
assert.ok(!legacySource.includes("@ObjectLink @Watch('rowChanged') row:"), 'negative control removes observed-row delivery');
const legacy = createReaderBuilderProbe(legacySource, boundedMembers(legacySource, 'SourceSwitchNovelRow'), deps,
  { ...properties.hooks, componentName: 'SourceSwitchNovelRow', initialParams: { candidate: candidate('a', 780, '旧章节') } });
legacy.owner.initialRender();
const legacyNumber = text(legacy.owner, '780'), legacyHit = hit(legacy.owner);
assert.ok(legacyNumber && legacyHit);
const legacyData = [candidate('a', 5, '新章节')];
const changes = [];
const legacyListener = { onDataChange: index => changes.push(index) };
legacyListener.onDataChange(0);
assert.equal(rows.sourceSwitchCandidateKey(legacyData[0].sourceId, legacyData[0].bookUrl),
  rows.sourceSwitchCandidateKey(legacy.owner.candidate.sourceId, legacy.owner.candidate.bookUrl));
properties.flush(); legacy.owner.replay();
assert.deepEqual(changes, [0]);
assert.equal(legacyNumber.create, '780', 'same-key CHANGE without a parent reset retains old @Prop latency');
assert.match(legacyHit.accessibilityText, /旧章节，搜索用时 780 ms$/);
assert.ok(properties.copies.some(copy => copy.name === 'candidate' && copy.object), 'negative control executes SDK one-way object copying');
console.log('PASS negative control: retained same-key SDK @Prop row remains stale after CHANGE/range request');

const dataSource = new rows.SourceSwitchCandidateDataSource();
const notifications = [];
const listener = { onDataReloaded: () => notifications.push(['reload']),
  onDataAdd: index => notifications.push(['add', index]), onDataChange: index => notifications.push(['change', index]) };
dataSource.registerDataChangeListener(listener); dataSource.registerDataChangeListener(listener);
const a = candidate('a', 780, '甲旧章节'), b = candidate('b', 950, '乙旧章节');
dataSource.publish([a, b]);
assert.deepEqual(notifications, [['add', 0], ['add', 1]], 'listener registration is idempotent');
const retainedA = dataSource.getData(0), retainedB = dataSource.getData(1);
assert.ok(properties.sdk.ObservedObject.IsObservedObject(retainedA), 'production constructor uses the actual SDK @Observed decorator');
assert.equal(retainedA.key, rows.sourceSwitchCandidateKey(a.sourceId, a.bookUrl));

let selected, cancellations = 0;
const control = createReaderBuilderProbe(source, ['candidateKey', 'selectCandidate', 'busy'], deps,
  { componentName: 'SourceSwitchWindow' }).owner;
Object.assign(control, { state: { kind: 'candidates' }, latestCandidates: [a, b], selectionPending: false,
  scrolling: false, heldKey: '', cancelPresentation() { cancellations += 1; }, onSelectCandidate(value) { selected = value; } });
const linked = createReaderBuilderProbe(source, boundedMembers(source, 'SourceSwitchNovelRow'), deps,
  { ...properties.hooks, componentName: 'SourceSwitchNovelRow', initialParams: { row: retainedA,
    onSelect: () => control.selectCandidate(retainedA.key) } });
linked.owner.initialRender();
assert.match(linked.output, /new SynchedPropertyNesedObjectPU\(params\.row/, 'compiler emits the ObjectLink property class');
assert.doesNotMatch(linked.output, /new SynchedPropertyOneWayPU\(params\.candidate/, 'observed row snapshots have no copied one-way candidate property');
const linkedNumber = text(linked.owner, '780'), linkedChapter = text(linked.owner, '甲旧章节'), linkedHit = hit(linked.owner);
const count = linked.owner.nodes.size, observerCount = linked.owner.observers.length;
assert.ok(linkedNumber && linkedChapter && linkedHit);
notifications.length = 0;
const changed = candidate('a', 5, '甲新章节');
dataSource.publish([changed, b]); control.latestCandidates = [changed, b]; properties.flush();
assert.deepEqual(notifications, [], 'same-key metadata does not replace native children with CHANGE');
assert.equal(dataSource.getData(0), retainedA); assert.equal(linked.owner.row, retainedA);
assert.equal(linkedNumber.create, '5'); assert.equal(linkedChapter.create, '甲新章节');
assert.match(linkedHit.accessibilityText, /甲新章节，搜索用时 5 ms$/);
linkedHit.onClick(); assert.equal(selected, changed, 'emitted row click enters actual latest-candidate selection');
assert.equal(cancellations, 1); control.selectionPending = false;

const changedAgain = candidate('a', 12, '甲再次更新');
const changedB = candidate('b', 3, '乙新章节');
dataSource.publish([changedB, changedAgain]); control.latestCandidates = [changedB, changedAgain]; properties.flush();
assert.deepEqual(notifications, [['reload']], 'reordering publishes a structural reload');
assert.equal(dataSource.getData(0), retainedB); assert.equal(dataSource.getData(1), retainedA);
assert.equal(linkedNumber.create, '12'); assert.equal(linkedChapter.create, '甲再次更新');
assert.match(linkedHit.accessibilityText, /甲再次更新，搜索用时 12 ms$/);
linkedHit.onClick(); assert.equal(selected, changedAgain, 'retained callback selects its exact current identity after reordering');
assert.equal(cancellations, 2); control.selectionPending = false;

for (let index = 0; index < 30; index += 1) {
  notifications.length = 0;
  const current = candidate('a', index + 20, `甲更新 ${index}`);
  const ordered = index % 2 ? [current, changedB] : [changedB, current];
  dataSource.publish(ordered); control.latestCandidates = ordered; properties.flush();
  assert.equal(dataSource.getData(index % 2 ? 0 : 1), retainedA);
  assert.equal(linkedNumber.create, String(index + 20)); assert.equal(linkedChapter.create, `甲更新 ${index}`);
  assert.match(linkedHit.accessibilityText, new RegExp(`甲更新 ${index}，搜索用时 ${index + 20} ms$`));
  assert.equal(linked.owner.nodes.size, count); assert.equal(linked.owner.observers.length, observerCount);
  linkedHit.onClick(); assert.equal(selected, current); control.selectionPending = false;
}
console.log('PASS SDK ObjectLink: two same-key updates and 30 reorder/update cycles retain actors and refresh text, accessibility and selection');

notifications.length = 0;
const alternate = candidate('a', 55, '同源另一目录', { bookUrl: '/book/a/alternate' });
dataSource.publish([changedAgain, changedB, alternate]);
assert.deepEqual(notifications, [['add', 2]], 'prefix append only admits the new row');
const retainedAlternate = dataSource.getData(2);
assert.notEqual(retainedAlternate, retainedA, 'same source with another book URL has a distinct stable row');
assert.notEqual(retainedAlternate.key, retainedA.key);
control.latestCandidates = [changedAgain, changedB, alternate];
for (const guard of [
  { selectionPending: true, scrolling: false, heldKey: '' },
  { selectionPending: false, scrolling: true, heldKey: '' },
  { selectionPending: false, scrolling: false, heldKey: retainedAlternate.key },
]) {
  Object.assign(control, guard); selected = undefined; const before = cancellations;
  linkedHit.onClick(); assert.equal(selected, undefined); assert.equal(cancellations, before);
}
Object.assign(control, { selectionPending: false, scrolling: false, heldKey: retainedAlternate.key });
control.selectCandidate(retainedAlternate.key); assert.equal(selected, alternate,
  'actual controller uses sourceId plus bookUrl, including held alternate identity');
control.selectionPending = false; control.heldKey = '';
notifications.length = 0; dataSource.publish([changedAgain]); properties.flush();
assert.deepEqual(notifications, [['reload']]); assert.equal(dataSource.getData(0), retainedA);
dataSource.unregisterDataChangeListener(listener); notifications.length = 0; dataSource.publish([]);
assert.deepEqual(notifications, []); assert.equal(dataSource.totalCount(), 0);
console.log('PASS production row data source: append, removal, alternate composite keys, click admission guards and listener retirement');
