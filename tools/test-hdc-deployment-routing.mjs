import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"routing":{"description":"Actual local/remote HDC argv/identity routing with captured runner; no HDC process","resources":[]}};
for(const id of selectContractCases(definitions)){await run();recordContractCasePass(id);}
async function run(){
const {default:assert}=await import("node:assert/strict");
const {hdcRouteEvidence,resolveHdcServer,runTargetHdc}=await import("../scripts/hap-pipeline.mjs");
// Focused, offline deployment-routing check. No HDC process or device is used.



const local = { serverKey: '127.0.0.1:8710', vmLocation: 'local' };
const remote = { serverKey: '192.168.1.10:8710', vmLocation: 'remote' };
assert.deepEqual(resolveHdcServer({ targetKind: 'physical' }), { serverKey: local.serverKey });
assert.deepEqual(resolveHdcServer({ targetKind: 'vm' }), local);
assert.deepEqual(resolveHdcServer({ targetKind: 'vm', vmLocation: 'remote' }), remote);
assert.deepEqual(resolveHdcServer({ targetKind: 'vm', configuredServer: remote.serverKey }), remote);
assert.deepEqual(resolveHdcServer({ targetKind: 'vm', vmLocation: 'local', configuredServer: '::ffff:127.0.0.1:8710' }), local);
assert.throws(() => resolveHdcServer({ targetKind: 'physical', configuredServer: remote.serverKey }), /conflicts/);
assert.throws(() => resolveHdcServer({ targetKind: 'physical', vmLocation: 'remote' }), /only to a VM/);
assert.throws(() => resolveHdcServer({ targetKind: 'vm', vmLocation: 'local', configuredServer: remote.serverKey }), /conflicts/);
assert.throws(() => resolveHdcServer({ targetKind: 'vm', vmLocation: 'remote', configuredServer: local.serverKey }), /conflicts/);
assert.throws(() => resolveHdcServer({ targetKind: 'vm', configuredServer: '127.0.0.1:9999' }), /unsupported/);
assert.throws(() => resolveHdcServer({ targetKind: 'vm', vmLocation: 'unknown' }), /local or remote/);

for (const route of [local, remote]) {
  const captured = [];
  const result = runTargetHdc('/fixture/hdc', '127.0.0.1:5555', route.serverKey,
    ['-t', '127.0.0.1:5555', 'shell', 'echo READY'], { timeoutMs: 10000 },
    (program, args, options) => { captured.push({ program, args, options }); return { status: 0, stdout: 'READY' }; });
  assert.equal(result.stdout, 'READY');
  const args = captured[0].args;
  assert.equal(args[args.indexOf('--server-key') + 1], route.serverKey, 'lease key must match the actual server');
  assert.equal(args[args.indexOf('-s') + 1], route.serverKey, 'HDC client must use the lease server');
  assert.equal(args[args.indexOf('--target') + 1], '127.0.0.1:5555');
  assert.equal(args[args.indexOf('-t') + 1], '127.0.0.1:5555', 'target is not a server address');
  assert.equal(captured[0].options.timeoutMs, 42000);
  assert.deepEqual(hdcRouteEvidence(route), { hdcServer: route.serverKey, vmLocation: route.vmLocation });
}
assert.deepEqual(hdcRouteEvidence({ serverKey: local.serverKey }), { hdcServer: local.serverKey });
console.log('PASS HDC deployment server selection, lease binding and receipt metadata');

}
