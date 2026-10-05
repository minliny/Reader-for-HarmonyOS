import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { acquireLease, releaseLease, targetRef } from '/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/tools/reader-hdc-lease.mjs';
const target = '127.0.0.1:5555';
const serverKey = '127.0.0.1:8710';
const hdc = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const root = '/private/tmp/reader-hdc-target-leases';
const owner = { token: randomUUID(), pid: process.pid, ppid: process.ppid, agentId: 'manga-reader-sheets-parity', target, targetRef: targetRef(target), serverKey, serverRef: targetRef(serverKey), hdc, command: ['interactive-manga-sheets-parity'], startedAt: new Date().toISOString() };
const lease = await acquireLease({ root, target, targetRefValue: owner.targetRef, lockRefValue: owner.serverRef, waitMs: 30000, owner });
let active;
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
const deadline = setTimeout(() => { active?.kill('SIGTERM'); rl.close(); }, 10 * 60 * 1000);
const stop = () => { active?.kill('SIGTERM'); rl.close(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
console.log(JSON.stringify({ status: 'lease-acquired', target, owner: owner.agentId, maxMinutes: 10 }));
try {
  for await (const line of rl) {
    if (!line.trim()) continue;
    const args = JSON.parse(line);
    if (args[0] === 'exit') break;
    if (!Array.isArray(args) || !args.every(a => typeof a === 'string') || !['shell', 'file'].includes(args[0])) throw Error('Only bound VM UI/snapshot commands allowed');
    const code = await new Promise((resolve, reject) => {
      active = spawn(hdc, ['-s', '::ffff:127.0.0.1:8710', '-t', target, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      active.stdout.pipe(process.stdout); active.stderr.pipe(process.stderr);
      active.on('error', reject); active.on('close', resolve);
    });
    active = undefined;
    console.log(JSON.stringify({ status: 'command-complete', code }));
  }
} finally {
  clearTimeout(deadline); rl.close(); releaseLease(root, lease.lockDir, owner);
  console.log(JSON.stringify({ status: 'lease-released' }));
}
