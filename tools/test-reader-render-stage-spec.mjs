import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "runtime-projection": {
    "description": "Pure continuous/paged runtime spec matrix",
    "resources": []
  },
  "host-projection-binding": {
    "description": "Actual Host simulation/mount methods use current projection parameters, not occurrence counts",
    "resources": []
  }
};

async function case_runtime_projection() {
const { default: fs } = await import('node:fs');
const { default: assert } = await import('node:assert/strict');
const { stripTypeScriptTypes } = await import('node:module');
const source = fs.readFileSync('entry/src/main/ets/features/reading/ReaderRenderStageSpec.ts', 'utf8');
const moduleSource = stripTypeScriptTypes(source, { mode: 'strip' });
const url = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`;
const mod = await import(url);
assert.equal(mod.readerRenderStageKind('continuous', true), 'continuous');
assert.equal(mod.readerRenderStageKind('continuous', false), 'paged');
assert.equal(mod.readerRenderStageKind('paged', true), 'paged');
assert.equal(mod.readerRenderStageKind('paged', false), 'paged');
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', false, false),
  { simulationActive: true, mountSurface: true });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', false, true),
  { simulationActive: false, mountSurface: true });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', true, false),
  { simulationActive: false, mountSurface: false });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('continuous', 'simulation', false, false),
  { simulationActive: false, mountSurface: false });

}

async function case_host_projection_binding() {
const { default: assert } = await import('node:assert/strict');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerBookTurnRuntimeSpec } = await import('../entry/src/main/ets/features/reading/ReaderRenderStageSpec.ts');
const Host = productionMotionMethods('entry/src/main/ets/features/reading/LocalReadingExperience.ets', ['usesBookTurnSimulation','shouldMountBookTurnSurface'], {readerBookTurnRuntimeSpec});
for(const mode of ['paged','continuous']) for(const transition of ['simulation','slide']) for(const reduced of [false,true]) for(const failed of [false,true]) {
 const owner = new Host();Object.assign(owner,{readerSettingsSnapshot:{navigationMode:mode,pageTransition:transition},reduceMotion:reduced,bookTurnRuntimeFailed:failed});
 const expected=readerBookTurnRuntimeSpec(mode,transition,reduced,failed);
 assert.equal(owner.usesBookTurnSimulation(),expected.simulationActive);
 assert.equal(owner.shouldMountBookTurnSurface(),expected.mountSurface);
}

}

const implementations = {'runtime-projection':case_runtime_projection,'host-projection-binding':case_host_projection_binding};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
