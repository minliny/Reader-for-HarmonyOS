// Exact offline regression for the production foreground listener checks.
// Only temporary loopback sockets and owned Node child processes are used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { inspectListeners, matchesOwnedListener, ownedProcessNameMatches,
  connectLocal, parseLsofListeners, validateLsofWarning } from './reader-hdc-foreground.mjs';

const children = [];
async function listen(host, port = 0) {
  const script = `const n=require('net');const s=n.createServer();s.listen({host:${JSON.stringify(host)},port:${port},ipv6Only:${host === '::1'}},()=>console.log(s.address().port));`;
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  try {
    const [data] = await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'close').then(([code, signal]) => {
        throw new Error(`owned listener exited before readiness (${code}/${signal}): ${stderr}`);
      }),
    ]);
    const bound = Number(String(data).trim());
    assert.ok(Number.isInteger(bound) && bound > 0, stderr);
    return { child, port: bound };
  } finally { clearTimeout(timeout); }
}

try {
  // IPv4-mapped IPv6 is the actual HDC channelHost form; lsof reports the
  // reachable loopback endpoint in IPv4 notation on this SDK host.
  const first = await listen('::ffff:127.0.0.1');
  const single = inspectListeners(first.port);
  assert.equal(await connectLocal(first.port), true);
  assert.equal(ownedProcessNameMatches(first.child.pid, process.execPath), true);
  assert.equal(matchesOwnedListener(single, first.child.pid, process.execPath, first.port), true);
  assert.equal(matchesOwnedListener(single, first.child.pid + 1, process.execPath, first.port), false);
  assert.equal(matchesOwnedListener(single, first.child.pid, '/fake/hdc', first.port), false);

  const second = await listen('::1', first.port);
  const shared = inspectListeners(first.port);
  assert.equal(shared.listeners.length, 2);
  assert.deepEqual(new Set(shared.listeners.map(x => x.pid)), new Set([first.child.pid, second.child.pid]));
  assert.equal(matchesOwnedListener(shared, first.child.pid, process.execPath, first.port), false);

  assert.throws(() => validateLsofWarning('lsof: unexpected permission denial'), /unrecognized warning/);
  assert.throws(() => parseLsofListeners('p123\ncnode\nf12', first.port), /incomplete/);
  assert.throws(() => parseLsofListeners(`p123\ncnode\nf12\np124\ncnode\nf9\nn127.0.0.1:${first.port}`, first.port), /incomplete/);
  assert.throws(() => parseLsofListeners(`p123\ncnode\nf12\nn127.0.0.1:${first.port + 1}`, first.port), /malformed/);
  console.log('PASS foreground listener: real IPv4-mapped loopback, owner, TCP, competing IPv6 and fail-closed parsing');
} finally {
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    await once(child, 'close');
  }));
}
