import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
const read = name => readFileSync(new URL('../entry/src/main/ets/features/common/' + name + '.ets', import.meta.url), 'utf8');
const sources = { button: read('ReaderButton'), labeled: read('ReaderLabeledIconAction'), recovery: read('ReaderRecoveryAction') };
const buttonRole = 'AccessibilityRoleType.BUTTON';
const physical = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'fontColor', 'maxLines',
  'width', 'height', 'layoutWeight', 'justifyContent', 'alignItems', 'padding', 'border', 'borderRadius', 'backgroundColor',
  'opacity', 'margin', 'responseRegion', 'textAlign', 'textOverflow', 'constraintSize', 'linearGradient'];
const tuple = node => [node.type, node.create, Object.fromEntries(physical.filter(k => Object.hasOwn(node, k)).map(k => [k, node[k]]))];
const params = owner => Object.fromEntries([...read(owner.specId?.startsWith('rss-') && owner.icon !== undefined ? 'ReaderLabeledIconAction' : owner.variant !== undefined ? 'ReaderRecoveryAction' : 'ReaderButton').matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m => [m[1], owner[m[1]]]));
function open(kind, variant, source = sources[kind]) {
  let count = 0;
  const initial = { label: '原动作', scheme: 'day', actionEnabled: true, onAction: () => count++, onReconcile: () => count++ };
  let owner, nodes, flush;
  if (kind === 'button') {
    const sdk = foundationControls({ buttonSource: source });
    owner = new sdk.button.Component(undefined, { ...initial, specId: variant });
    owner.aboutToAppear(); owner.initialRender(); nodes = () => sdk.nodes(owner); flush = () => sdk.properties.flush();
  } else if (kind === 'labeled') {
    const sdk = labeledIconControls({ source });
    owner = new sdk.component(undefined, { ...initial, specId: variant, icon: 'actual-icon' });
    owner.aboutToAppear(); owner.initialRender(); nodes = () => sdk.nodes(owner); flush = () => sdk.properties.flush();
  } else {
    const sdk = boundedSurfaceSdk({ ReaderRecoveryAction: source });
    owner = sdk.consumer(source, boundedMembers(source), {}, { ...initial, variant, generation: 19 });
    owner.initialRender(); nodes = () => sdk.nodes(owner); flush = () => sdk.properties.flush();
  }
  const hit = nodes().find(n => n.onClick);
  assert.ok(hit, 'actual SDK emitted one native hit actor');
  return { owner, nodes, hit, count: () => count, update(changes) { owner.updateStateVars({ ...params(owner), ...changes }); flush(); } };
}
function semantics(actor, enabled) {
  assert.equal(actor.hit.accessibilityText, actor.owner.label, 'actual native action name');
  assert.equal(actor.hit.accessibilityRole, buttonRole, 'actual native button role');
  assert.equal(actor.hit.enabled, enabled, 'native eligibility retains business Prop');
  assert.equal(actor.hit.focusable, enabled, 'native focus follows eligible business action');
}
const branches = [['button', 'source-action', 'Text'], ['button', 'sync-action', 'Stack'],
  ['labeled', 'rss-feed', 'Stack'], ['labeled', 'rss-manage', 'Row'],
  ['recovery', 'compact', 'Text'], ['recovery', 'rssManagement', 'Text']];
let groups = 0;
for (const [kind, variant, type] of branches) {
  const a = open(kind, variant); assert.equal(a.hit.type, type, kind + ':' + variant + ' actual native branch');
  semantics(a, true); const retained = a.hit.onClick; retained(); assert.equal(a.count(), 1);
  a.update({ actionEnabled: false, label: '禁用动作' }); semantics(a, false); retained(); assert.equal(a.count(), 1, 'retained disabled callback never dispatches');
  a.update({ actionEnabled: true, label: '当前动作' }); semantics(a, true); retained(); assert.equal(a.count(), 2, 'retained current eligible Prop still dispatches original intent');
  if (kind !== 'recovery') { a.owner.aboutToDisappear(); retained(); assert.equal(a.count(), 2, 'existing mounted producer guard preserved'); }
  const oldSource = sources[kind].replaceAll('.accessibilityRole(AccessibilityRoleType.BUTTON)', '').replaceAll('.focusable(this.actionEnabled)', '');
  const old = open(kind, variant, oldSource), current = open(kind, variant);
  assert.deepEqual(current.nodes().map(tuple), old.nodes().map(tuple), 'required semantic attrs are the only physical/AUTO difference');
  const noRole = open(kind, variant, sources[kind].replaceAll('.accessibilityRole(AccessibilityRoleType.BUTTON)', ''));
  assert.throws(() => semantics(noRole, true), /actual native button role/, 'deleting actual role must break SDK proof');
  const alwaysFocus = open(kind, variant, sources[kind].replaceAll('.focusable(this.actionEnabled)', '.focusable(true)'));
  alwaysFocus.update({ actionEnabled: false });
  assert.throws(() => semantics(alwaysFocus, false), /native focus follows/, 'focusable=true on disabled actual node must break SDK proof');
  groups++;
}
// Recovery retirement is intentionally owned by the existing immutable domain
// actor. Execute the real decorated RSS surface; no replacement closure/owner.
{
  const source = readFileSync(new URL('../entry/src/main/ets/features/rss/RssOriginalRecoverySurface.ets', import.meta.url), 'utf8');
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  let calls = 0;
  const original = { blocked: true, busy: false, generation: 31, operationId: 'original-rss-operation', method: 'rss.source.delete',
    scope: 'management', confirmation: 'unknown', writeStage: 'write', canRetryOriginal: true, message: '原结果待核对', subscriptionId: '', guid: '' };
  const owner = sdk.consumer(source, boundedMembers(source), {}, { original, presentationIdentity: 'rss-a', scope: 'management',
    onReconcileOriginal: () => calls++, onContinueOriginal: () => calls++ });
  owner.aboutToAppear(); owner.initialRender();
  const actors = sdk.walk(owner).filter(o => o instanceof sdk.deps.ReaderRecoveryAction);
  const retained = actors.map(o => sdk.nodes(o).find(n => n.onClick));
  assert.equal(retained.length, 2); retained.forEach(n => { assert.equal(n.accessibilityRole, buttonRole); assert.equal(n.focusable, true); n.onClick(); });
  assert.equal(calls, 2); owner.aboutToDisappear(); retained.forEach(n => n.onClick()); assert.equal(calls, 2, 'actual R3 parent blocks retired Recovery callbacks');
  groups++;
}
console.log(`PASS shared action semantics: ${groups} actual SDK branch/parent groups; BUTTON name/role/eligible focus, retained disabled/current/mounted callbacks, recovery R3 retirement, exact physical/AUTO tuple, removed-role and forced-focus negative controls. OS keyboard/screen-reader behavior remains separate.`);
