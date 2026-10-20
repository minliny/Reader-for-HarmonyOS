import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'sampler':{description:'Pure production replacement geometry/header responsive endpoints and reversal',resources:[]},
 'recovery-actor':{description:'Actual SDK original-operation keyed actor and stale physical callback negative',resources:[]},
 'historical-motion':{description:'Explicit archived motion comparison, excluded from current release',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { existsSync }=await import('node:fs');
const { readFile }=await import('node:fs/promises');
const { registerHooks }=await import('node:module');
const resolution=registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
try {
const { sampleReaderControlReplace: sample, readerControlReplaceEndpoint: endpoint,
  sampleReaderControlReplaceHeader: header } =
  await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const q = sample(0, 286, 190);
const f = sample(1, 338, 666);
if(selectedCase==='historical-motion'){
const motionPath = new URL('../evidence/control-bar-development-20260905/replace-live-motion-context-20260905.json', import.meta.url);
assert.ok(existsSync(motionPath),'selected historical comparison requires archived source');
const motion=JSON.parse(await readFile(motionPath,'utf8'));
function sourceValue(nodeId, property, percent) {
  assert.ok(motion, 'optional archived replace motion capture is required for source-value comparison when present');
  const node = motion.nodes.find(n => n.nodeId === nodeId);
  assert.ok(node, `missing live-source actor ${nodeId}`);
  const match = node.codeSnippets.css.match(new RegExp(`${percent}% \\{ ${property}: ([^;]+);`));
  assert.ok(match, `${nodeId} ${property} ${percent}%`);
  return match[1].split(' ').map(value => parseFloat(value));
}
{
  assert.equal(q.rowHeight, sourceValue('1939:1237', 'height', 0)[0]);
  assert.equal(f.rowHeight, sourceValue('1939:1237', 'height', 100)[0]);
  assert.equal(q.list.width, sourceValue('1939:1237', 'width', 0)[0]);
  assert.equal(f.list.width, sourceValue('1939:1237', 'width', 100)[0]);
  assert.equal(q.list.y, 58 + 63 + sourceValue('1939:1237', 'translate', 0)[1] - 29,
    'full static viewport/list offsets are converted once into the Quick Stage slot');
}

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);

  close(header(0, 338).title.x, 14 + 24 + sourceValue('1939:1223', 'translate', 0)[0] - 13);
  close(header(0, 338).title.y, 20 + 6.5 + sourceValue('1939:1223', 'translate', 0)[1] - 19);
  assert.equal(header(0, 338).title.width, sourceValue('1939:1223', 'width', 0)[0]);
  assert.equal(header(1, 338).title.width, sourceValue('1939:1223', 'width', 100)[0]);
return;
}
if(selectedCase==='sampler'){
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
}
if(selectedCase==='recovery-actor'){
const content=await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url),'utf8');
const { checkReaderReplaceRecoveryActor } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
await checkReaderReplaceRecoveryActor(content);
const identityGuard = 'if (operationId !== undefined && this.state.writeOperationId !== operationId) return;';
assert.ok(content.includes(identityGuard));
await assert.rejects(checkReaderReplaceRecoveryActor(content.replace(identityGuard, '')), /old physical actor/,
  'removing only the real exact-operation guard breaks the original retained-callback scenario');
}
}finally{resolution.deregister();}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
