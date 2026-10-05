import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { acquireLease, releaseLease, targetRef } from '/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/tools/reader-hdc-lease.mjs';

// This session accepts fixed numeric-log / UI-layout operations only. There is
// no arbitrary shell, image capture, cache, source-content or file-read port.
const target = '127.0.0.1:5555';
const serverKey = '127.0.0.1:8710';
const hdc = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const output = '/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-04-manga-native-origin-r8/vm';
const transcript = output + '/numeric-session.jsonl';
const root = '/private/tmp/reader-hdc-target-leases';
const nonce = randomUUID();
const owner = { token: randomUUID(), pid: process.pid, ppid: process.ppid, agentId: 'manga-native-origin-r8', target, targetRef: targetRef(target), serverKey, serverRef: targetRef(serverKey), hdc, command: ['fixed-native-geometry-and-ui-tree-only'], startedAt: new Date().toISOString() };
const fixed = {
  targets: ['list', 'targets'],
  boot: ['shell', 'param', 'get', 'bootevent.boot.completed'],
  sceneboard: ['shell', 'pidof', 'com.ohos.sceneboard'],
  readerPid: ['shell', 'pidof', 'io.reader.minliny'],
  guestEpoch: ['shell', 'date', '+%s'],
  hilogHelp: ['shell', 'hilog', '-h'],
  stop: ['shell', 'aa', 'force-stop', 'io.reader.minliny'],
  startProbe: ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry', '--pb', 'readerMangaImageOriginProbe', 'true'],
  startNormal: ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry'],
  log: ['shell', 'hilog', '-x', '-T', 'MangaGeometry'],
  continue: ['shell', 'uitest', 'uiInput', 'click', '1075', '654'],
  center: ['shell', 'uitest', 'uiInput', 'click', '640', '1400'],
  directory: ['shell', 'uitest', 'uiInput', 'click', '285', '2602'],
  closePanel: ['shell', 'uitest', 'uiInput', 'click', '1175', '930'],
  back: ['shell', 'uitest', 'uiInput', 'click', '135', '262'],
};
const labels = new Set(['shelf', 'a', 'b', 'c', 'd', 'exit', 'normal']);
const created = new Set();
mkdirSync(output, { recursive: true, mode: 0o700 });
const lease = await acquireLease({ root, target, targetRefValue: owner.targetRef, lockRefValue: owner.serverRef, waitMs: 30000, owner });
let active;
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
const deadline = setTimeout(() => { active?.kill('SIGTERM'); rl.close(); }, 10 * 60 * 1000);
const stop = () => { active?.kill('SIGTERM'); rl.close(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
console.log(JSON.stringify({ status: 'lease-acquired', target, owner: owner.agentId, nonce, maxMinutes: 10 }));
try {
  for await (const line of rl) {
    if (!line.trim()) continue;
    const operation = JSON.parse(line);
    if (!operation || Array.isArray(operation) || Object.keys(operation).some(k => !['op', 'label'].includes(k))) throw Error('Fixed operation object required');
    if (operation.op === 'exit') break;
    let args = fixed[operation.op];
    if (['tree', 'recvTree'].includes(operation.op)) {
      if (!labels.has(operation.label)) throw Error('UI tree label is outside fixed allowlist');
      const remote = '/data/local/tmp/reader-r8-' + nonce + '-' + operation.label + '.json';
      if (operation.op === 'tree') {
        args = ['shell', 'uitest', 'dumpLayout', '-p', remote, '-a'];
        created.add(operation.label);
      } else {
        if (!created.has(operation.label)) throw Error('Only a UI tree created by this session may be received');
        args = ['file', 'recv', remote, output + '/' + operation.label + '.json'];
      }
    }
    if (!args) throw Error('Operation is outside numeric/UI-tree allowlist');
    appendFileSync(transcript, JSON.stringify({ at: new Date().toISOString(), operation, args }) + '\n');
    const code = await new Promise((resolve, reject) => {
      active = spawn(hdc, ['-s', '::ffff:127.0.0.1:8710', '-t', target, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      active.stdout.pipe(process.stdout); active.stderr.pipe(process.stderr);
      active.stdout.on('data', data => appendFileSync(transcript, data));
      active.stderr.on('data', data => appendFileSync(transcript, data));
      active.on('error', reject); active.on('close', resolve);
    });
    active = undefined;
    console.log(JSON.stringify({ status: 'command-complete', operation, code }));
    if (code !== 0) throw Error('Command failed; session stopped');
  }
} finally {
  clearTimeout(deadline); rl.close(); releaseLease(root, lease.lockDir, owner);
  console.log(JSON.stringify({ status: 'lease-released' }));
}
