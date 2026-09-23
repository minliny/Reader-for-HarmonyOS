import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderPreparationNetworkHost.ts', import.meta.url), 'utf8');
const lowered = stripTypeScriptTypes(source.replace(/^import .*;\n/m, '')).replace('export class', 'class');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture({ registrationError = false } = {}) {
  const events = new Map(), requests = []; let app = 0, defaultNet = 7, capabilities = [11];
  let registered = 0, unregistered = 0, changed = 0, capabilityRead;
  const observer = { on: (name, callback) => events.set(name, callback),
    register(callback) { registered++; callback(registrationError ? Error('registration failed') : undefined); }, unregister(callback) { unregistered++; callback(undefined); } };
  const connection = { NetCap: { NET_CAPABILITY_NOT_METERED: 11 }, createNetConnection: () => observer,
    getAppNet: async () => ({ netId: app }), getDefaultNet: async () => ({ netId: defaultNet }),
    getNetCapabilities: async net => { requests.push(net.netId); return capabilityRead ? capabilityRead.promise : { networkCap: capabilities }; } };
  const Host = new Function('connection', `${lowered};return ReaderPreparationNetworkHost;`)(connection);
  const host = new Host(() => changed++);
  return { host, events, requests, setApp: n => { app = n; }, setDefault: n => { defaultNet = n; },
    setCaps: c => { capabilities = c; }, gate: g => { capabilityRead = g; }, counts: () => ({ registered, unregistered, changed }) };
}
{
  const f = fixture({ registrationError: true }); f.host.setForeground(true); await tick();
  assert.equal(f.host.allowed(), false, 'no automatic network without a registered change listener');
  assert.equal(f.requests.length, 0, 'failed registration cannot race a one-off successful capability read');
  f.host.setForeground(false); f.host.setForeground(true); await tick();
  assert.equal(f.counts().registered, 2, 'a later foreground event may retry registration');
  f.host.close();
}
{
  const f = fixture(); assert.equal(f.host.allowed(), false);
  f.host.setForeground(true); await tick(); assert.equal(f.host.allowed(), true);
  f.setCaps([]); f.events.get('netCapabilitiesChange')();
  assert.equal(f.host.allowed(), false, 'network changes revoke permission synchronously');
  await tick(); assert.equal(f.host.allowed(), false, 'metered/unknown networks do not authorize backfill');
  f.setCaps(undefined); f.events.get('netAvailable')(); await tick(); assert.equal(f.host.allowed(), false);
  f.setCaps([11]); f.setApp(9); f.events.get('netAvailable')(); await tick();
  assert.equal(f.requests.at(-1), 9, 'use the app-selected network'); assert.equal(f.host.allowed(), true);
  f.host.setForeground(false); assert.equal(f.host.allowed(), false);
  f.events.get('netAvailable')(); await tick(); assert.equal(f.host.allowed(), false);
  f.host.close(); assert.equal(f.counts().registered, 1); assert.equal(f.counts().unregistered, 1);
}
{
  const f = fixture(), old = deferred(); f.gate(old); f.host.setForeground(true); await tick();
  f.host.setForeground(false); old.resolve({ networkCap: [11] }); await tick();
  assert.equal(f.host.allowed(), false, 'late capability result cannot reauthorize a background app');
  f.host.close();
}
{
  const f = fixture(), old = deferred(); f.gate(old); f.host.setForeground(true); await tick();
  f.gate(undefined); f.setCaps([]); f.events.get('netCapabilitiesChange')(); await tick();
  old.resolve({ networkCap: [11] }); await tick();
  assert.equal(f.host.allowed(), false, 'stale network response cannot override newer metered state');
  f.host.close();
}
console.log('Reader preparation network admission: PASS');
