import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { sampleReaderControlReplace: sample, readerControlReplaceEndpoint: endpoint,
  sampleReaderControlReplaceHeader: header } =
  await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const q = sample(0, 286, 190);
const f = sample(1, 338, 666);
const motionPath = new URL('../evidence/control-bar-development-20260905/replace-live-motion-context-20260905.json', import.meta.url);
const motion = existsSync(motionPath) ? JSON.parse(await readFile(motionPath, 'utf8')) : null;
function sourceValue(nodeId, property, percent) {
  assert.ok(motion, 'optional archived replace motion capture is required for source-value comparison when present');
  const node = motion.nodes.find(n => n.nodeId === nodeId);
  assert.ok(node, `missing live-source actor ${nodeId}`);
  const match = node.codeSnippets.css.match(new RegExp(`${percent}% \\{ ${property}: ([^;]+);`));
  assert.ok(match, `${nodeId} ${property} ${percent}%`);
  return match[1].split(' ').map(value => parseFloat(value));
}
if (motion) {
  assert.equal(q.rowHeight, sourceValue('1939:1237', 'height', 0)[0]);
  assert.equal(f.rowHeight, sourceValue('1939:1237', 'height', 100)[0]);
  assert.equal(q.list.width, sourceValue('1939:1237', 'width', 0)[0]);
  assert.equal(f.list.width, sourceValue('1939:1237', 'width', 100)[0]);
  assert.equal(q.list.y, 58 + 63 + sourceValue('1939:1237', 'translate', 0)[1] - 29,
    'full static viewport/list offsets are converted once into the Quick Stage slot');
} else {
  console.log('archived replace motion capture absent; optional source-value checks skipped');
}
assert.deepEqual(q.list, { x: 17.55, y: 47.55, width: 250, height: 84, opacity: 1 });
assert.deepEqual(f.list, { x: 14, y: 64, width: 310, height: 589, opacity: 1 });
assert.equal(q.rowHeight, 28);
assert.equal(f.rowHeight, 77);
assert.equal(q.rowGap, 0);
assert.equal(f.rowGap, 7);
assert.equal(Object.hasOwn(q, 'nameSize'), false, 'geometry no longer owns a duplicate physical font recipe');
assert.equal(Object.hasOwn(f, 'nameSize'), false);
assert.equal(q.toolbar.y, 60, '71px shell static top + 18px source translate - 29px Quick Stage slot');
assert.equal(f.toolbar.y, 14, '71px shell static top - 57px Full Stage slot');
assert.equal(q.list.height, q.rowHeight * 3, 'Quick clips exactly three shared rows');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
assert.deepEqual(header(0, 338), {
  title: { x: 66.55, y: 29.55, width: 208, height: 14, opacity: 1 },
  icon: { x: 1, y: 22, width: 16, height: 16, opacity: 0 },
  action: { x: 297, y: 17, width: 40, height: 26, opacity: 0 },
});
assert.deepEqual(header(1, 338), {
  title: { x: 25, y: 7.5, width: 84, height: 17, opacity: 1 },
  icon: { x: 1, y: 8, width: 16, height: 16, opacity: 1 },
  action: { x: 297, y: 3, width: 40, height: 26, opacity: 1 },
});
if (motion) {
  close(header(0, 338).title.x, 14 + 24 + sourceValue('1939:1223', 'translate', 0)[0] - 13);
  close(header(0, 338).title.y, 20 + 6.5 + sourceValue('1939:1223', 'translate', 0)[1] - 19);
  assert.equal(header(0, 338).title.width, sourceValue('1939:1223', 'width', 0)[0]);
  assert.equal(header(1, 338).title.width, sourceValue('1939:1223', 'width', 100)[0]);
}
for (const p of [0, .01, .2, .49, .5, .83, 1]) {
  const pose = sample(p, 286 + 52 * p, 190 + 476 * p, 100);
  assert.equal(Object.hasOwn(pose, 'nameSize'), false, 'fixed typography belongs to the shared role and actual Text tests');
  close(pose.rowHeight, 28 + 49 * p);
  close(pose.rowGap, 7 * p);
  close(pose.rowPadding, 5 + 8 * p);
  close(pose.toggleWidth, 27 + 17 * p);
  close(pose.toggleHeight, 16 + 8 * p);
  close(pose.thumbSize, 12 + 8 * p);
  for (const actor of ['toolbar', 'list', 'back', 'quickFooter']) {
    for (const key of ['x', 'y', 'width', 'height', 'opacity']) close(pose[actor][key], q[actor][key] + (f[actor][key] - q[actor][key]) * p);
  }
  assert.equal('scrollCompensation' in pose, false, 'scroll lifecycle is separate from authored geometry');
  assert.deepEqual(pose, sample(p, 286 + 52 * p, 190 + 476 * p, 100), 'reversal is history-free and never re-eases p');
  assert.equal(endpoint(p, true), p === 0 ? 'quick' : p === 1 ? 'full' : 'none');
  assert.equal(endpoint(p, false), 'none');
  for (const actor of ['title', 'icon', 'action']) {
    for (const key of ['x', 'y', 'width', 'height', 'opacity']) {
      close(header(p, 338)[actor][key], header(0, 338)[actor][key] +
        (header(1, 338)[actor][key] - header(0, 338)[actor][key]) * p);
    }
  }
  assert.equal(header(p, 338).title.opacity, 1, 'persistent title must never use whole-header p fade');
}
for (const width of [240, 262, 286, 338, 520]) {
  const pose = sample(1, width, 420);
  assert.ok(pose.list.x >= 0 && pose.list.x + pose.list.width <= width);
  assert.ok(pose.toolbar.x >= 0 && pose.toolbar.x + pose.toolbar.width <= width);
  assert.equal(pose.list.y + pose.list.height, 407);
  close(header(.5, width).action.x + 40, width - 1);
}
const content = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets', import.meta.url), 'utf8');
assert.equal((content.match(/ForEach\(this\.state\.rules,/g) || []).length, 1, 'one shared canonical rule tree');
assert.doesNotMatch(content, /ForEach\([^\n]*slice|setInterval|setTimeout|animateTo|\.animation\(/);
assert.match(content, /control-replace-rule-\$\{rule\.id\}/);
assert.match(content, /ReaderControlSwitchTrack/);
for (const action of ['新增规则', '导入', '导出', '确认删除']) assert.ok(content.includes(action));
assert.match(content, /private originalRecoveryAction\(\)[^]*ForEach\(\[this\.state\.writeOperationId \|\| ''\],[^]*this\.textAction\(this\.state\.recoveryLabel \|\| '核对原规则操作'/, 'recovery remains available through the finite original-operation actor');
assert.match(content, /this\.reload\(operationId \|\| undefined\)/, 'native recovery delegates the captured exact original operation, not a list-based unlock');
assert.match(content, /ReaderBoundedSurfaceActions\(\{ specId: 'replace-editor'/);
assert.match(content, /onAction: \(id: string\): void => \{ if \(id === 'cancel'\) this\.cancelTemporaryLayer\(\); else this\.saveEditor\(\); \}/);
const actions = await readFile(new URL('../entry/src/main/ets/features/common/ReaderBoundedSurfaceActions.ets', import.meta.url), 'utf8');
assert.ok(actions.includes("@Prop primaryLabel: string = '保存'") && actions.includes("Text(this.primaryLabel)") && actions.includes("Text('取消')"), 'retained canonical actions live in the actual shared producer');
assert.match(content, /this\.presentationRevision/);
assert.match(content, /key === this\.state\.sessionKey/);
const { checkReaderReplaceRecoveryActor } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
await checkReaderReplaceRecoveryActor(content);
const identityGuard = 'if (operationId !== undefined && this.state.writeOperationId !== operationId) return;';
assert.ok(content.includes(identityGuard));
await assert.rejects(checkReaderReplaceRecoveryActor(content.replace(identityGuard, '')), /old physical actor/,
  'removing only the real exact-operation guard breaks the original retained-callback scenario');
console.log('PASS reader-control-replace-geometry: production endpoint/midpoint sampling, widths and one-tree wiring; NOT native pixel acceptance');
