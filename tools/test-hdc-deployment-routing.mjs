import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  routing: 'Original routing assertions bind explicit location, lease server, target and timeout metadata with an injected runner.',
  'lease-session': 'Original exact storage lease-session leaf uses private fake Node transport to retain one token and clear proxies.',
  'deployment-session': 'Actual canonical deployment session passes its owner to the callback and spans preflight, recheck, install and launch fixture commands.',
  'guarded-exports': 'Current PR storage/ABI/UID/post-install guard bodies remain equal after only the reviewed transport normalization.',
};
const selected = selectContractCases(definitions);
const hash = value => createHash('sha256').update(value).digest('hex');
const pipeline = () => import('../scripts/hap-pipeline.mjs');

async function routingCase() {
  const { hdcRouteEvidence, resolveHdcServer, runTargetHdc } = await pipeline();
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

  // The real inspect entry must reach manifest validation only for the routes
  // eligible to proceed. No candidate or real HDC commands are needed here.
  const directory = mkdtempSync(join(tmpdir(), 'reader-deployment-log-routing-'));
  try {
    const manifest = join(directory, 'invalid-manifest.json');
    const hdc = join(directory, 'fixture-hdc');
    writeFileSync(manifest, '{}');
    writeFileSync(hdc, '#!/bin/sh\nprintf "Unexpected HDC invocation\\n" >&2\nexit 99\n', { mode: 0o700 });
    const script = fileURLToPath(new URL('../scripts/hap-pipeline.mjs', import.meta.url));
    const logs = ['--vm-log', join(directory, 'operator-selected-emulator.log')];
    for (const [args, server, status, message] of [
      [[], undefined, 2, /current instance emulator log/],
      [logs, local.serverKey, 1, /invalid HAP run manifest/],
      [['--vm-location', 'remote'], undefined, 1, /invalid HAP run manifest/],
      [[], remote.serverKey, 1, /invalid HAP run manifest/],
      [[...logs, '--vm-location', 'remote'], remote.serverKey, 1, /invalid HAP run manifest/],
      [['--vm-log', ''], remote.serverKey, 2, /missing --vm-log/],
      [['--vm-location', 'remote'], local.serverKey, 1, /conflicts/],
    ]) {
      const env = { ...process.env, HDC: hdc, READER_HDC_LEASE_ROOT: join(directory, 'locks') };
      if (server === undefined) delete env.READER_HDC_SERVER_KEY;
      else env.READER_HDC_SERVER_KEY = server;
      const result = spawnSync(process.execPath, [script, 'inspect', '--manifest', manifest, '--artifact', 'signed',
        '--target', 'fixture-device', '--target-kind', 'vm', ...args], { env, encoding: 'utf8', timeout: 5000 });
      assert.ifError(result.error);
      assert.equal(result.status, status, result.stderr);
      assert.match(result.stderr, message);
      assert.doesNotMatch(result.stderr, /Unexpected HDC invocation/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function leaseSessionCase() {
    const { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { withHdcCommandSession, targetRef } = await import('./reader-hdc-lease.mjs');
    const directory = mkdtempSync(join(tmpdir(), 'reader-storage-lease-'));
    const prior = process.env.READER_HDC_LEASE_ROOT;
    process.env.READER_HDC_LEASE_ROOT = join(directory, 'locks');
    try {
      const fixture = join(directory, 'fixture.cjs'), executable = join(directory, 'fixture-hdc');
      writeFileSync(fixture, `process.stdout.write(JSON.stringify({argv:process.argv.slice(2),proxy:process.env.HTTP_PROXY??null,noProxy:process.env.NO_PROXY})+'\\n');`);
      const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
      writeFileSync(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`, { mode: 0o700 });
      const options = { hdc: executable, target: 'fixture-device', serverKey: '127.0.0.1:18710', waitMs: 0 };
      let retained;
      await withHdcCommandSession(options, async session => {
        retained = session;
        const lock = join(process.env.READER_HDC_LEASE_ROOT, `${targetRef(options.serverKey)}.lock`, 'owner.json');
        const token = JSON.parse(readFileSync(lock, 'utf8')).token;
        for (const command of [['shell', 'echo fixture'], ['list', 'targets', '-v']]) {
          const result = JSON.parse(session.runSync(command, { env: { ...process.env, HTTP_PROXY: 'http://invalid:9' } }).stdout);
          assert.equal(result.proxy, null); assert.equal(result.noProxy, '*');
          assert.equal(JSON.parse(readFileSync(lock, 'utf8')).token, token);
          assert.equal(result.argv[0], '-p');
        }
        assert.throws(() => session.runSync(['shell', 'echo fixture'], { timeoutMs: 30001 }), /budget/);
        await assert.rejects(withHdcCommandSession(options, () => {}), /lease wait timed out/);
      });
      assert.throws(() => retained.runSync(['list', 'targets']), /expired/);
      assert.equal(readdirSync(process.env.READER_HDC_LEASE_ROOT).some(name => name.endsWith('.lock')), false);
    } finally {
      if (prior === undefined) delete process.env.READER_HDC_LEASE_ROOT; else process.env.READER_HDC_LEASE_ROOT = prior;
      rmSync(directory, { recursive: true, force: true });
    }
    return;
}

async function deploymentSessionCase() {
  const { withDeploymentHdcSession, runTargetHdc } = await pipeline();
  const { withHdcCommandSession, targetRef } = await import('./reader-hdc-lease.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'reader-deployment-session-'));
  const names = ['HDC', 'READER_HDC_LEASE_ROOT', 'READER_HDC_SERVER_KEY'];
  const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const target = '127.0.0.1:5555';
  const serverKey = '192.168.1.10:8710';
  const options = new Map([['--target', target], ['--target-kind', 'vm'], ['--vm-location', 'remote']]);
  try {
    const fixture = join(directory, 'fixture.cjs');
    const executable = join(directory, 'fixture-hdc');
    writeFileSync(fixture, "process.stdout.write(JSON.stringify({argv:process.argv.slice(2),proxy:process.env.HTTP_PROXY??null,noProxy:process.env.NO_PROXY})+'\\n');");
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    writeFileSync(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`, { mode: 0o700 });
    process.env.HDC = executable;
    process.env.READER_HDC_LEASE_ROOT = join(directory, 'locks');
    process.env.READER_HDC_SERVER_KEY = serverKey;
    const lock = join(process.env.READER_HDC_LEASE_ROOT, `${targetRef(serverKey)}.lock`, 'owner.json');
    const phases = [];
    let retained;
    await withDeploymentHdcSession(options, async session => {
      retained = session;
      assert.equal(session.hdc, executable);
      assert.equal(session.target, target);
      assert.equal(session.serverKey, serverKey);
      const token = JSON.parse(readFileSync(lock, 'utf8')).token;
      for (const [phase, args] of [
        ['preflight', ['list', 'targets', '-v']],
        ['copy-proof', ['shell', 'fixture-copy-proof']],
        ['final-recheck', ['shell', 'fixture-final-recheck']],
        ['install', ['install', '-r', '/private/fixture candidate.hap']],
        ['launch', ['shell', 'fixture-launch']],
      ]) {
        await Promise.resolve();
        const received = JSON.parse(runTargetHdc(executable, target, serverKey, args,
          { env: { ...process.env, HTTP_PROXY: 'http://fixture.invalid:9' } }).stdout);
        assert.equal(received.proxy, null);
        assert.equal(received.noProxy, '*');
        assert.equal(received.argv[received.argv.indexOf('-s') + 1], serverKey);
        if (phase !== 'preflight') assert.equal(received.argv[received.argv.indexOf('-t') + 1], target);
        assert.equal(JSON.parse(readFileSync(lock, 'utf8')).token, token);
        phases.push(phase);
      }
      assert.throws(() => runTargetHdc(executable, 'other-target', serverKey, ['shell', 'fixture']), /identity mismatch/);
      assert.throws(() => runTargetHdc(executable, target, '127.0.0.1:8710', ['shell', 'fixture']), /identity mismatch/);
      await assert.rejects(withDeploymentHdcSession(options, () => {}), /nested/);
      await assert.rejects(withHdcCommandSession({ hdc: executable, target: 'other-target', serverKey, waitMs: 0 }, () => {}), /lease wait timed out/);
    });
    assert.deepEqual(phases, ['preflight', 'copy-proof', 'final-recheck', 'install', 'launch']);
    assert.throws(() => retained.runSync(['list', 'targets']), /expired/);
    await assert.rejects(withDeploymentHdcSession(options, () => { throw new Error('fixture-stop'); }), /fixture-stop/);
    assert.equal(readdirSync(process.env.READER_HDC_LEASE_ROOT).some(name => name.endsWith('.lock')), false);
    const events = readFileSync(join(process.env.READER_HDC_LEASE_ROOT, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.filter(event => ['acquire', 'release'].includes(event.type)).map(event => event.type),
      ['acquire', 'release', 'acquire', 'release']);
  } finally {
    for (const name of names) {
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

async function guardedExportsCase() {
  const current = await pipeline();
  for (const name of ['withDeploymentHdcSession', 'withHapRunLock', 'installDeployment', 'verifyManifest', 'storageTransitionCandidate']) {
    assert.equal(typeof current[name], 'function', `existing canonical function ${name} is exported`);
  }
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts } = installedEtsCompiler();
  const source = readFileSync(new URL('../scripts/hap-pipeline.mjs', import.meta.url), 'utf8');
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/hdc-deployment-before/guard-bodies.json', import.meta.url), 'utf8'));
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const parse = value => ts.createSourceFile('HapTransportGuard.mjs', value, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tree = parse(source);
  assert.deepEqual(tree.parseDiagnostics, []);
  const declaration = name => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const normalizedBody = (name, text) => {
    let body = text;
    if (name === 'resolveDeployment') {
      body = body.replace(fixture.routeDeclaration, '').replace(fixture.currentDeviceQuery, fixture.prDeviceQuery)
        .replaceAll('assertTargetConnected(hdc, target, hdcRoute.serverKey)', 'assertTargetConnected(hdc, target)')
        .replaceAll('installedMetadata(hdc, target, hdcRoute.serverKey)', 'installedMetadata(hdc, target)')
        .replace('    hdcRoute,\n', '');
    }
    if (name === 'installDeployment') {
      body = body.replaceAll('runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey, [', 'runTargetHdc(resolved.hdc, resolved.target, [')
        .replaceAll('installedMetadata(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey)', 'installedMetadata(resolved.hdc, resolved.target)');
    }
    body = body.replaceAll('...hdcRouteEvidence(resolved.hdcRoute),', '');
    const parsed = parse(`function guard() ${body}`);
    assert.deepEqual(parsed.parseDiagnostics, []);
    return printer.printNode(ts.EmitHint.Unspecified, parsed.statements[0].body, parsed);
  };
  for (const [name, expected] of Object.entries(fixture.functions)) {
    const node = declaration(name);
    assert.ok(node?.body, `actual current guard ${name}`);
    assert.equal(hash(normalizedBody(name, node.body.getText(tree))), expected, `PR guard body preserved for ${name}`);
  }
  for (const [name, from, to] of [
    ['assertInstalledDeploymentIdentity', 'after.uid !== before.uid', 'false'],
    ['installDeployment', 'if (!resolved.route.allowed)', 'if (false)'],
    ['resolveDeployment', "policy: 'formal-stopped-transition-required'", "policy: 'retained-logs-admitted'"],
  ]) {
    const body = declaration(name).body.getText(tree);
    assert.ok(body.includes(from));
    assert.notEqual(hash(normalizedBody(name, body.replace(from, to))), fixture.functions[name], `removed ${name} guard is rejected`);
  }
  for (const command of ['inspect', 'install']) {
    const matches = [];
    const visit = node => {
      if (ts.isIfStatement(node) && node.expression.getText(tree) === `command === '${command}'`) matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(declaration('main'));
    assert.equal(matches.length, 1);
    assert.ok(ts.isExpressionStatement(matches[0].thenStatement));
    const expression = matches[0].thenStatement.expression;
    assert.ok(ts.isAwaitExpression(expression));
    assert.equal(expression.expression.expression.getText(tree), 'withDeploymentHdcSession');
  }
}

const cases = { routing: routingCase, 'lease-session': leaseSessionCase,
  'deployment-session': deploymentSessionCase, 'guarded-exports': guardedExportsCase };
for (const id of selected) {
  await cases[id]();
  recordContractCasePass(id);
}
