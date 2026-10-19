import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, openSync, closeSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { randomUUID, createHash } from 'node:crypto';

export const MAX_CONTRACT_TIMEOUT_MS = 110_000;
export const MAX_CONTRACT_KILL_GRACE_MS = 1_000;
export const MAX_CONTRACT_SCOPE_TIMEOUT_MS = 600_000;
const ORDERED_DEVELOPMENT_SCOPES = ['search-return-runtime'];

/** A retired name stays unavailable even if an old checkout restores its file. */
export function retiredContractTests() {
  const registry = JSON.parse(readFileSync(new URL('./retired-contract-tests.json', import.meta.url), 'utf8'));
  assert.equal(registry.schemaVersion, 1, 'unsupported retired contract registry');
  assert.ok(Array.isArray(registry.entries), 'retired contract entries are required');
  for (const entry of registry.entries) {
    assert.ok(typeof entry.id === 'string' && entry.id.length > 0, 'retired contract identity is required');
    assert.match(entry.file, /^test-[^/\\]+\.mjs$/, 'invalid retired contract filename');
  }
  assert.equal(new Set(registry.entries.map(entry => entry.id)).size, registry.entries.length, 'duplicate retired contract identity');
  assert.equal(new Set(registry.entries.map(entry => entry.file)).size, registry.entries.length, 'duplicate retired contract filename');
  return registry.entries;
}

function activeContractInventory(manifest, discovered) {
  const retired = new Set(retiredContractTests().map(entry => entry.file));
  const registrations = [...manifest.source, ...manifest.integration,
    ...Object.values(manifest.scopes ?? {}).flat(),
    ...Object.values(manifest.scopePolicies ?? {}).flatMap(policy => policy.layers?.flatMap(layer => layer.tests) ?? [])];
  assert.ok(registrations.every(name => !retired.has(name)), 'retired contract cannot be registered in a tier, scope or evidence layer');
  return discovered.filter(name => !retired.has(name));
}

export function contractScopePolicy(manifest, scope) {
  if (scope === undefined) return null;
  assert.ok(typeof scope === 'string' && scope.length > 0 && Object.hasOwn(manifest.scopes ?? {}, scope), 'unknown contract scope');
  const policy = manifest.scopePolicies?.[scope];
  if (ORDERED_DEVELOPMENT_SCOPES.includes(scope)) assert.ok(policy, scope + ' requires its declared scope policy');
  if (policy === undefined) return { timeoutMs: MAX_CONTRACT_TIMEOUT_MS, failFast: false };
  assert.ok(Number.isInteger(policy.timeoutMs) && policy.timeoutMs > 0 && policy.timeoutMs <= MAX_CONTRACT_SCOPE_TIMEOUT_MS,
    'invalid declared scope deadline');
  if (scope === 'search-return-runtime') assert.ok(policy.timeoutMs <= 180_000, 'search-return-runtime deadline cannot exceed 180 seconds');
  assert.equal(typeof policy.failFast, 'boolean', 'scope failFast must be explicit');
  if (ORDERED_DEVELOPMENT_SCOPES.includes(scope)) assert.equal(policy.failFast, true, scope + ' requires fail-fast');
  assert.ok(Array.isArray(policy.layers) && policy.layers.length > 0, 'scope evidence layers are required');
  assert.equal(new Set(policy.layers.map(layer => layer.id)).size, policy.layers.length, 'duplicate scope evidence layer');
  for (const layer of policy.layers) {
    assert.match(layer.id, /^[a-z][a-z0-9-]+$/, 'invalid scope evidence layer');
    assert.ok(Array.isArray(layer.tests) && layer.tests.length > 0, 'empty scope evidence layer');
    assert.ok(typeof layer.proves === 'string' && layer.proves.trim() &&
      typeof layer.doesNotProve === 'string' && layer.doesNotProve.trim(), 'scope evidence boundary is required');
  }
  const tests = policy.layers.flatMap(layer => layer.tests);
  assert.equal(new Set(tests).size, tests.length, 'duplicate scope evidence test');
  assert.deepEqual([...tests].sort(), [...manifest.scopes[scope]].sort(), 'every scoped test must have one evidence layer');
  return policy;
}

const GROUP_PROTOCOL = 'reader-contract-owned-process-group-v1';
function announceOwnedGroup(action, pid) {
  if (!process.connected || !process.send || !process.env.READER_CONTRACT_GROUP_OWNER) return;
  try { process.send({ protocol: GROUP_PROTOCOL, token: process.env.READER_CONTRACT_GROUP_OWNER, action, pid }, () => {}); }
  catch { /* A lost parent also loses its receipt; its owner must remain closed. */ }
}

// Each real spawn owns one POSIX group. Nested uses of this same runner
// announce their real groups through Node's private parent/child IPC channel,
// so cancellation does not lose those groups when a controller exits first.
// Uncooperative code that starts other sessions is outside this boundary.
function runOwnedContract(root, name, fd, env, timeoutMs, killGraceMs, active, blockDispatch, caseIds = []) {
  return new Promise(resolveResult => {
    const processGroups = process.platform !== 'win32';
    const ownerToken = randomUUID(), ownedGroups = new Set(), allOwnedGroups = new Set();
    let child, error, deadline, escalation, poll, terminationStarted, groupMessageHandler;
    let timedOut = false, scopeTimedOut = false, closed = false, settled = false;
    let status, signal, orphanDescendants = false;
    const termination = [];
    const observeGroup = pid => {
      try { process.kill(-pid, 0); }
      catch (failure) {
        if (failure.code === 'ESRCH') { ownedGroups.delete(pid); announceOwnedGroup('remove', pid); }
        else error ??= `process group observation: ${failure.code ?? failure.message}`;
      }
    };
    const groupAlive = () => {
      if (!child?.pid) return false;
      if (!processGroups) return !closed;
      for (const pid of ownedGroups) observeGroup(pid);
      return ownedGroups.size > 0; // Failed observations keep ownership closed.
    };
    const terminate = requestedSignal => {
      if (!child?.pid) return;
      let sent = false;
      for (const pid of processGroups ? ownedGroups : [child.pid]) {
        try { sent = (processGroups ? process.kill(-pid, requestedSignal) : child.kill(requestedSignal)) || sent; }
        catch (failure) {
          if (failure.code !== 'ESRCH') error ??= `process group termination: ${failure.code ?? failure.message}`;
        }
      }
      termination.push({ signal: requestedSignal, sent });
    };
    const finish = treeSettled => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline); clearTimeout(escalation); clearTimeout(poll);
      if (groupMessageHandler) child.removeListener('message', groupMessageHandler);
      if (child?.connected) child.disconnect();
      active.delete(child);
      if (!treeSettled) {
        error ??= 'owned process group remained alive after termination grace';
        blockDispatch();
      }
      resolveResult({ status, signal, error, timedOut, scopeTimedOut, termination,
        processGroupId: processGroups ? child?.pid ?? null : null, orphanDescendants,
        ownedProcessGroups: [...allOwnedGroups],
        treeCapability: processGroups ? 'posix-process-group' : 'direct-child',
        treeSettled: treeSettled && !processGroups ? null : treeSettled, directChildSettled: closed || !child?.pid });
    };
    const observeTermination = () => {
      if (settled) return;
      if (!groupAlive() && closed) { finish(true); return; }
      const remaining = terminationStarted + killGraceMs - performance.now();
      if (remaining <= 0) { terminate('SIGKILL'); finish(false); return; }
      if (poll === undefined) poll = setTimeout(() => { poll = undefined; observeTermination(); }, Math.min(10, remaining));
    };
    const beginTermination = reason => {
      if (settled) return;
      if (reason === 'scope') { timedOut = true; scopeTimedOut = true; }
      else if (reason === 'timeout') timedOut = true;
      else if (reason === 'blocked') error ??= 'another owned process group could not be reclaimed';
      else if (reason === 'cancelled') error ??= 'contract run cancelled';
      clearTimeout(deadline);
      if (terminationStarted === undefined) {
        terminationStarted = performance.now();
        terminate('SIGTERM');
        // Leave part of the same (at most one second) budget for the OS to
        // reap KILLed descendants, instead of releasing at the KILL instant.
        escalation = setTimeout(() => { if (groupAlive()) terminate('SIGKILL'); }, Math.min(100, killGraceMs / 2));
      }
      observeTermination();
    };
    try {
      child = spawn(process.execPath, [resolve(root, 'tools', name), ...(caseIds.length ? ['--case', caseIds.join(',')] : [])],
        { cwd: root, stdio: processGroups ? ['ignore', fd, fd, 'ipc'] : ['ignore', fd, fd],
          env: { ...env, READER_CONTRACT_GROUP_OWNER: ownerToken }, detached: processGroups });
    } catch (failure) { error = failure.code ?? failure.message; finish(true); return; }
    if (processGroups && child.pid) {
      ownedGroups.add(child.pid); allOwnedGroups.add(child.pid); announceOwnedGroup('add', child.pid);
      groupMessageHandler = message => {
        if (message?.protocol !== GROUP_PROTOCOL || message.token !== ownerToken ||
            !Number.isInteger(message.pid) || message.pid <= 0 || message.pid === child.pid ||
            !['add', 'remove'].includes(message.action)) return;
        if (message.action === 'add') {
          ownedGroups.add(message.pid); allOwnedGroups.add(message.pid); announceOwnedGroup('add', message.pid);
          if (terminationStarted !== undefined) terminate(performance.now() - terminationStarted >= Math.min(100, killGraceMs / 2) ? 'SIGKILL' : 'SIGTERM');
        } else if (ownedGroups.has(message.pid)) {
          // A completed inner group does not authorize probing its still-live
          // siblings during their exit/reap windows. Verify only this removal;
          // cancellation and final settlement still inspect every owned group.
          observeGroup(message.pid);
        }
      };
      child.on('message', groupMessageHandler);
    }
    active.set(child, beginTermination);
    deadline = setTimeout(() => beginTermination('timeout'), timeoutMs);
    child.once('error', event => { error = event.code ?? event.message; });
    child.once('exit', (code, exitSignal) => { status = code; signal = exitSignal; clearTimeout(deadline); });
    child.once('close', (code, exitSignal) => {
      status = code; signal = exitSignal; closed = true;
      clearTimeout(deadline);
      if (!groupAlive()) { finish(true); return; }
      if (terminationStarted === undefined) {
        orphanDescendants = true;
        error ??= 'orphan descendants remained after test process exit';
      }
      beginTermination('orphan');
    });
  });
}

export function contractSelection(manifest, discovered, tier, scope) {
  assert.ok(['source', 'full'].includes(tier));
  assert.equal(manifest.schemaVersion, 1);
  discovered = activeContractInventory(manifest, discovered);
  const declared = [...manifest.source, ...manifest.integration];
  assert.equal(new Set(declared).size, declared.length, 'duplicate test classification');
  assert.deepEqual([...declared].sort(), discovered, 'every discovered test must be classified');
  for (const [name, tests] of Object.entries(manifest.scopes ?? {})) {
    assert.match(name, /^[a-z][a-z0-9-]+$/, 'invalid contract scope name');
    assert.ok(Array.isArray(tests) && tests.length > 0, 'empty contract scope is not PASS');
    assert.equal(new Set(tests).size, tests.length, 'duplicate scope test');
    assert.ok(tests.every(test => discovered.includes(test)), 'unclassified scope test');
    contractScopePolicy(manifest, name);
  }
  assert.ok(Object.keys(manifest.scopePolicies ?? {}).every(name => Object.hasOwn(manifest.scopes ?? {}, name)), 'orphan contract scope policy');
  if (scope !== undefined) {
    assert.equal(tier, 'full', 'scope cannot replace the source tier');
    assert.ok(Object.hasOwn(manifest.scopes ?? {}, scope), 'unknown contract scope');
  }
  const scopePolicy = contractScopePolicy(manifest, scope);
  // These finite development scopes declare feedback order as well as set.
  // Preserve each scope's direct/consumer/witness ordering from its policy.
  // Full and manga retain their existing alphabetical selection contract.
  const selected = ORDERED_DEVELOPMENT_SCOPES.includes(scope) ? scopePolicy.layers.flatMap(layer => layer.tests) :
    [...(scope === undefined ? tier === 'source' ? manifest.source : discovered : manifest.scopes[scope])].sort();
  assert.ok(selected.length > 0, 'empty test tier is not PASS');
  return { selected, omitted: discovered.filter(test => !selected.includes(test)), inventory: discovered,
    integrationCount: manifest.integration.length, scopePolicy };
}

export function contractInventory(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'tools/contract-test-tiers.json'), 'utf8'));
  const discovered = readdirSync(resolve(root, 'tools')).filter(name =>
    /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  return { manifest, discovered: activeContractInventory(manifest, discovered) };
}

export function contractTests(root, tier, scope) {
  const { manifest, discovered } = contractInventory(root);
  return contractSelection(manifest, discovered, tier, scope);
}

/** Explicit individual checks never expand to an implicit full/source suite. */
export function explicitContractTests(root, names) {
  const retired = new Set(retiredContractTests().map(entry => entry.file));
  assert.ok(Array.isArray(names) && names.every(name => !retired.has(name)), 'retired contract cannot be selected explicitly');
  const { manifest, discovered: inventory } = contractInventory(root);
  const declared = [...manifest.source, ...manifest.integration];
  assert.ok(Array.isArray(names) && names.length > 0 && names.every(name =>
    typeof name === 'string' && /^test-[^/\\]+\.mjs$/.test(name) && inventory.includes(name) && declared.includes(name)), 'unknown or empty explicit test selection');
  assert.equal(new Set(names).size, names.length, 'duplicate explicit test');
  return { selected: [...names], omitted: inventory.filter(name => !names.includes(name)), inventory,
    integrationCount: manifest.integration.length, nestedTestImports: reviewedTestImports(root, names), scopePolicy: null };
}

/** Metadata only; never import a test to discover its cases or resource needs. */
export function contractCaseSelection(root, names, requested = {}) {
  assert.ok(requested && typeof requested === 'object' && !Array.isArray(requested), 'case selection must be a file-to-IDs object');
  assert.ok(Object.keys(requested).every(name => names.includes(name)), 'cases must belong to an explicitly selected file');
  let metadata;
  try { metadata = JSON.parse(readFileSync(resolve(root, 'tools/contract-case-manifest.json'), 'utf8')); }
  catch { metadata = { schemaVersion: 1, files: {}, legacy: {} }; }
  assert.equal(metadata.schemaVersion, 1, 'unsupported contract case manifest');
  const selections = {}, resources = new Set();
  for (const name of names) {
    const source = readFileSync(resolve(root, 'tools', name), 'utf8');
    const focused = /from\s+['"]\.\/lib\/contract-case-selection\.mjs['"]/.test(source);
    const ids = requested[name] ?? [];
    assert.ok(Array.isArray(ids) && new Set(ids).size === ids.length, 'select unique case IDs');
    if (focused) assert.ok(ids.length > 0, `${name}: focused case selection required; a list is NOT_RUN, never PASS`);
    const declarations = metadata.files?.[name]?.cases;
    if (ids.length) {
      assert.ok(focused && declarations && ids.every(id => typeof id === 'string' && Object.hasOwn(declarations, id)), `${name}: unknown or unpublished case; no whole-file fallback`);
      assert.ok(ids.every(id=>declarations[id].qualification === 'QUALIFIED'), `${name}: selected case is not qualified for dispatch; no broader fallback`);
      const expected = metadata.files[name].sourceSha256;
      assert.ok(/^[a-f0-9]{64}$/.test(expected ?? '') && createHash('sha256').update(source).digest('hex') === expected, `${name}: reviewed case/resource definition changed; review this file before dispatch`);
      selections[name] = [...ids];
    }
    const needs = ids.length ? ids.flatMap(id => declarations[id].resources ?? ['UNREVIEWED']) : metadata.legacy?.[name]?.resources;
    assert.ok(Array.isArray(needs) && needs.every(value => ['native-build', 'shared-build', 'network-fixture'].includes(value)), `${name}: resource declaration must be reviewed before dispatch`);
    needs.forEach(value => resources.add(value));
  }
  return { selections, resources: [...resources] };
}

function caseReceipts(log, expected) {
  if (!expected.length) return [];
  const receipts = [];
  for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (row?.kind === 'reader-contract-case-result') receipts.push(row);
  }
  assert.deepEqual(receipts.map(row => row.case).sort(), [...expected].sort(), 'case receipts must exactly match selection; missing, duplicate or extra case is not PASS');
  assert.ok(receipts.every(row => row.status === 'PASS'), 'every selected case must pass');
  return receipts;
}

function reviewedTestImports(root, names) {
  // Side-effect test imports execute assertions too. Require those modules in
  // the reviewed list instead of silently widening an individual selection.
  const toolsRoot = resolve(root, 'tools'), visited = new Set(), nested = [];
  const retired = new Set(retiredContractTests().map(entry => entry.file));
  function visit(path, owner) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    const imports = [
      ...source.matchAll(/(?:^|\n)\s*import\s+(?:[^'";]*?\bfrom\s*)?['"]([^'"]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
      ...source.matchAll(/(?:^|\n)\s*export\s+[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ];
    for (const match of imports) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) continue;
      const dependency = fileURLToPath(new URL(specifier, pathToFileURL(path)));
      if (!dependency.endsWith('.mjs')) continue;
      // Node ignores query/fragment when reading file modules. Neither those
      // suffixes nor an absolute file URL may revive a retired assertion.
      assert.ok(!retired.has(basename(dependency)), `retired contract ${basename(dependency)} cannot be imported (from ${owner})`);
      if (!dependency.startsWith(toolsRoot + '/') && !dependency.startsWith(toolsRoot + '\\')) continue;
      const name = dependency.slice(toolsRoot.length + 1);
      if (/^test-[^/\\]+\.mjs$/.test(name)) {
        nested.push({ from: owner, test: name });
        assert.ok(names.includes(name), `explicit selection also requires imported test ${name} (from ${owner}); review and name every nested check`);
      }
      visit(dependency, owner);
    }
  }
  for (const name of names) visit(resolve(toolsRoot, name), name);
  return nested;
}

export function runContracts(root, tier) {
  const { selected, integrationCount } = contractTests(root, tier);
  reviewedTestImports(root, selected);
  contractCaseSelection(root, selected); // Focused files cannot silently list and turn green.
  for (const name of selected) {
    const result = spawnSync(process.execPath, [resolve(root, 'tools', name)], {
      cwd: root, stdio: 'inherit', timeout: MAX_CONTRACT_TIMEOUT_MS, killSignal: 'SIGKILL',
    });
    if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.error?.code ?? result.status ?? result.signal})`);
  }
  console.log(`Host ${tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}`);
}

/** Opt-in bounded execution of the same classified inventory. Each test has
 * its own process and log. All started tests settle; every failure is retained
 * and the gate is nonzero. No test result or prior source snapshot is reused. */
export async function runContractsBounded(root, tier, workers = 1, testOptions = {}) {
  const runStarted = performance.now();
  // Windows retains its direct-child behavior. Its receipt explicitly does
  // not prove descendant settlement: taskkill /T cannot recover an exited
  // parent's tree. POSIX uses the OS process group instead.
  const treeCapability = process.platform === 'win32' ? 'direct-child' : 'posix-process-group';
  assert.ok(Number.isInteger(workers) && workers >= 1 && workers <= 4, 'workers must be an integer in 1..4');
  const timeoutMs = testOptions.timeoutMs ?? MAX_CONTRACT_TIMEOUT_MS;
  const killGraceMs = testOptions.killGraceMs ?? MAX_CONTRACT_KILL_GRACE_MS;
  const explicit = testOptions.tests !== undefined;
  const { selected, omitted, inventory, integrationCount, scopePolicy, nestedTestImports } = explicit ?
    explicitContractTests(root, testOptions.tests) : contractTests(root, tier, testOptions.scope);
  const reviewedImports = nestedTestImports ?? reviewedTestImports(root, selected);
  const caseSelection = contractCaseSelection(root, selected, testOptions.cases);
  if (explicit) assert.equal(workers, 1, 'explicit checks run sequentially in the reviewed order');
  const scopeTimeoutMs = scopePolicy === null ? null : testOptions.scopeTimeoutMs ?? scopePolicy.timeoutMs;
  const failFast = explicit || (scopePolicy?.failFast ?? false);
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_CONTRACT_TIMEOUT_MS, 'invalid test deadline');
  assert.ok(Number.isInteger(killGraceMs) && killGraceMs > 0 && killGraceMs <= MAX_CONTRACT_KILL_GRACE_MS, 'invalid termination grace');
  assert.ok(scopeTimeoutMs === null || Number.isInteger(scopeTimeoutMs) && scopeTimeoutMs > 0 && scopeTimeoutMs <= scopePolicy.timeoutMs,
    'invalid scope deadline');
  assert.ok(scopeTimeoutMs === null || killGraceMs <= 1_000, 'scope termination grace must be at most one second');
  const logRoot = mkdtempSync(resolve(tmpdir(), 'reader-contract-run-'));
  const results = [], active = new Map(); let cursor = 0, scopeExpired = false, treeRecoveryBlocked = false, cancelled = false, failureStopped = false;
  const expireScope = () => {
    scopeExpired = true;
    for (const abort of active.values()) abort('scope');
  };
  const blockDispatch = () => {
    treeRecoveryBlocked = true;
    for (const abort of active.values()) abort('blocked');
  };
  const cancel = () => {
    cancelled = true;
    for (const abort of active.values()) abort('cancelled');
  };
  testOptions.signal?.addEventListener('abort', cancel);
  process.on('SIGTERM', cancel); process.on('SIGINT', cancel);
  if (testOptions.signal?.aborted) cancel();
  const scopeDeadline = scopeTimeoutMs === null ? undefined : setTimeout(expireScope,
    Math.max(0, scopeTimeoutMs - (performance.now() - runStarted)));
  async function worker() {
    while (cursor < selected.length) {
      if (scopeTimeoutMs !== null && performance.now() - runStarted >= scopeTimeoutMs) expireScope();
      if (scopeExpired || treeRecoveryBlocked || cancelled || failureStopped) return;
      const name = selected[cursor++], started = performance.now(), wallStarted = Date.now(), log = resolve(logRoot, name + '.log');
      const temporaryDirectory = resolve(logRoot, 'temporary', name);
      mkdirSync(temporaryDirectory, { recursive: true });
      const fd = openSync(log, 'wx');
      const childEnvironment = { ...process.env, TMPDIR: temporaryDirectory, TMP: temporaryDirectory, TEMP: temporaryDirectory };
      // A nested fixture runner must not overwrite this run's result file or
      // inherit the canonical parent's remaining scope budget as a new run.
      delete childEnvironment.READER_CONTRACT_RESULTS_FILE;
      delete childEnvironment.READER_CONTRACT_SCOPE_TIMEOUT_MS;
      const caseIds = caseSelection.selections[name] ?? [];
      const result = await runOwnedContract(root, name, fd, childEnvironment, timeoutMs, killGraceMs, active, blockDispatch, caseIds);
      closeSync(fd);
      let receipts = [];
      if (!result.error && !result.timedOut && result.status === 0) {
        try { receipts = caseReceipts(log, caseIds); }
        catch (failure) { result.error = failure.message; }
      }
      // Only an actually successful, closed child releases its own temporary
      // storage. Failed/expired children retain fixtures alongside their logs.
      // This never scans or removes the shared OS temp root or user data.
      let temporaryStorageRemoved = false;
      if (!result.error && !result.timedOut && result.status === 0 && result.treeSettled !== false) {
        try { rmSync(temporaryDirectory, { recursive: true }); temporaryStorageRemoved = true; }
        catch (failure) { result.error = `temporary cleanup: ${failure.code ?? failure.message}`; }
      }
      const row = { name, ...result, cases: caseIds, caseReceipts: receipts, milliseconds: Math.round(performance.now() - started),
        wallMilliseconds: Date.now() - wallStarted, log, temporaryDirectory, temporaryStorageRemoved };
      results.push(row);
      if (failFast && (row.error || row.timedOut || row.status !== 0 || row.treeSettled === false)) failureStopped = true;
      console.log(`${name}: ${!row.error && !row.timedOut && row.status === 0 && row.treeSettled !== false ? 'PASS' : 'FAIL'} (${row.milliseconds}ms)`);
    }
  }
  const workersStarted = Array.from({ length: Math.min(workers, selected.length) }, worker);
  let workerFailure;
  try { await Promise.all(workersStarted); }
  catch (error) {
    workerFailure = error;
    expireScope();
    await Promise.allSettled(workersStarted); // Reap every owned child before clearing the deadline.
  } finally {
    clearTimeout(scopeDeadline); testOptions.signal?.removeEventListener('abort', cancel);
    process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  }
  const millisecondsTotal = Math.ceil(performance.now() - runStarted);
  if (scopeTimeoutMs !== null && millisecondsTotal > scopeTimeoutMs) scopeExpired = true;
  results.sort(explicit || ORDERED_DEVELOPMENT_SCOPES.includes(testOptions.scope) ?
    (a, b) => selected.indexOf(a.name) - selected.indexOf(b.name) : (a, b) => a.name.localeCompare(b.name));
  const unrun = selected.filter(name => !results.some(row => row.name === name));
  const selectedPassed = !workerFailure && !scopeExpired && !treeRecoveryBlocked && !cancelled && unrun.length === 0 &&
    results.every(row => !row.error && !row.timedOut && row.status === 0 && row.treeSettled !== false);
  const completeSuite = !explicit && testOptions.scope === undefined && tier === 'full';
  assert.equal(active.size, 0, 'every started child must report its process-tree result');
  if (!scopeExpired && !treeRecoveryBlocked && !cancelled && !failureStopped) assert.equal(results.length, selected.length, 'every selected test must settle');
  const report = { schemaVersion: 1, name: 'reader-harmony-contract-results', tier,
    ...(testOptions.rationale ? { rationale: testOptions.rationale } : {}),
    scope: explicit ? 'custom' : testOptions.scope ?? tier, selected, omitted, inventory, workers, timeoutMs, killGraceMs,
    nestedTestImports: reviewedImports, caseSelection: caseSelection.selections, resources: caseSelection.resources,
    ...(explicit ? { executionOrder: 'explicit-selection-order' } : {}),
    scopeTimeoutMs, scopeExpired, millisecondsTotal, unrun, failFast, failureStopped, treeRecoveryBlocked, cancelled, treeCapability,
    selectedStatus: selectedPassed ? 'PASS' : 'FAIL',
    harmonyContracts: !selectedPassed ? 'FAIL' : completeSuite ? 'PASS' : 'PARTIAL',
    fullSuite: completeSuite ? selectedPassed ? 'PASS' : 'FAIL' : 'NOT_RUN', acceptanceEligible: false,
    ...(scopePolicy?.layers ? { evidenceLayers: scopePolicy.layers } : {}),
    treeSettled: treeRecoveryBlocked ? false : treeCapability === 'direct-child' ? null : results.every(row => row.treeSettled), results };
  try {
    writeFileSync(resolve(logRoot, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    if (testOptions.resultsFile) writeFileSync(testOptions.resultsFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  } catch (error) { throw Object.assign(error, { treeSettled: report.treeSettled, report: { ...report, logRoot } }); }
  const failed = results.filter(row => row.error || row.timedOut || row.status !== 0 || row.treeSettled === false);
  const failure = message => Object.assign(new Error(message), { treeSettled: report.treeSettled, report: { ...report, logRoot } });
  if (workerFailure) throw failure(`contract worker failed (${workerFailure.message}); ${resolve(logRoot, 'results.json')}`);
  if (treeRecoveryBlocked) throw failure(`owned process group could not be reclaimed; no further test was started; ${resolve(logRoot, 'results.json')}`);
  if (cancelled) throw failure(`contract run cancelled; ${resolve(logRoot, 'results.json')}`);
  if (scopeExpired) throw failure(`scope ${testOptions.scope} failed (total timeout ${scopeTimeoutMs}ms; elapsed ${millisecondsTotal}ms; ` +
    `unrun ${unrun.join(',') || '<none>'}); ${resolve(logRoot, 'results.json')}`);
  if (failed.length) throw failure(failed.map(row => `${row.name} failed (${row.timedOut
    ? `timeout ${timeoutMs}ms; exit ${row.status ?? row.signal}; termination ${row.termination.map(entry => entry.signal).join(',')}`
    : row.error ?? row.status ?? row.signal}); ${row.log}`).join('\n'));
  console.log(`Host ${explicit ? 'explicit checks (full suite NOT_RUN)' : testOptions.scope ? `scope ${testOptions.scope} (full suite NOT_RUN)` : tier === 'source' ? 'source (full suite NOT_RUN)' : tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}; logs: ${logRoot}`);
  return { ...report, logRoot };
}

if (process.argv[1] && process.argv[1] !== '-' && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2], options = new Map();
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (mode === undefined || mode === '--list') {
    assert.ok(process.argv.length <= 3, 'list mode does not accept execution arguments');
    const { manifest, discovered } = contractInventory(repository);
    console.log(JSON.stringify({ status: 'NOT_RUN', harmonyContracts: 'NOT_RUN', fullSuite: 'NOT_RUN', acceptanceEligible: false,
      availableTests: discovered, availableScopes: Object.keys(manifest.scopes ?? {}),
      selection: 'Explicit --tests, --scope, --source or --full only after item-specific necessity review.' }));
  } else {
  assert.ok(['--source', '--full', '--scope', '--tests'].includes(mode),
    'Usage: node tools/run-contract-tests.mjs [--list|--source|--full|--scope <name>|--tests <comma-separated names>] --rationale <item-specific reason> [--cases file.mjs#case-id,...] [--results-file <file>] [--test-timeout-ms <1..110000>]');
  let cursor = 3, scope, tests;
  if (mode === '--scope') { scope = process.argv[cursor++]; assert.ok(scope && !scope.startsWith('--'), 'missing contract scope'); }
  if (mode === '--tests') { const value = process.argv[cursor++]; assert.ok(value && !value.startsWith('--'), 'missing explicit test selection'); tests = value.split(','); }
  for (; cursor < process.argv.length; cursor += 2) {
    const key = process.argv[cursor], value = process.argv[cursor + 1];
    assert.ok(['--results-file', '--test-timeout-ms', '--rationale', '--cases'].includes(key) && !options.has(key) && value && !value.startsWith('--'), 'invalid contract runner argument');
    options.set(key, value);
  }
  assert.ok(options.get('--rationale')?.trim(), 'an item-specific necessity rationale is required before running checks');
  const tier = mode === '--source' ? 'source' : 'full';
  if (tests) explicitContractTests(repository, tests);
  else reviewedTestImports(repository, contractTests(repository, tier, scope).selected); // Reject unknown or unreviewed nested checks before acquiring the shared toolchain.
  const cases = {};
  if (options.has('--cases')) {
    assert.ok(tests, '--cases requires exact --tests files');
    for (const value of options.get('--cases').split(',')) {
      const parts = value.split('#');
      assert.ok(parts.length === 2 && parts.every(Boolean), 'use --cases file.mjs#case-id');
      (cases[parts[0]] ??= []).push(parts[1]);
    }
  }
  const caseSelection = contractCaseSelection(repository, tests ?? contractTests(repository, tier, scope).selected, cases);
  // The standalone dispatcher consumes the same toolchain as HAP/Native. A
  // diagnostic run must not bypass their shared owner, including when each
  // test gets a different OS temporary directory.
  const needsBuildLease=caseSelection.resources.some(value=>['native-build','shared-build'].includes(value));
  const lease = needsBuildLease ? (await import('../../Reader-Core/scripts/lib/build-resource-lock.mjs')).acquireBuildLease() : { env: { ...process.env }, release() {} };
  let treeSettled = true;
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.on('SIGTERM', cancel); process.on('SIGINT', cancel);
  try {
    Object.assign(process.env, lease.env);
    await runContractsBounded(repository, tier,
      tests ? 1 : Number(process.env.READER_CONTRACT_TEST_WORKERS ?? 1), { scope, tests, cases,
        timeoutMs: Number(options.get('--test-timeout-ms') ?? process.env.READER_CONTRACT_TEST_TIMEOUT_MS ?? MAX_CONTRACT_TIMEOUT_MS),
        scopeTimeoutMs: scope === undefined || process.env.READER_CONTRACT_SCOPE_TIMEOUT_MS === undefined ? undefined : Number(process.env.READER_CONTRACT_SCOPE_TIMEOUT_MS),
        resultsFile: options.get('--results-file') ?? process.env.READER_CONTRACT_RESULTS_FILE,
        rationale: options.get('--rationale'),
        signal: cancellation.signal });
  } catch (error) { treeSettled = error.treeSettled !== false; throw error; }
  finally {
    process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
    if (treeSettled) lease.release();
  }
  }
}
