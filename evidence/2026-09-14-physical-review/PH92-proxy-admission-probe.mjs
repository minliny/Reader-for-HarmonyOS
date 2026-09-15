import assert from 'node:assert/strict';
import { productionMotionMethods } from '../../tools/lib/reader-motion-method-probe.mjs';
import { isPrivateNetworkTarget } from '../../entry/src/main/ets/app/HttpTransportPolicy.ts';

const file = new URL('../../entry/src/main/ets/app/HttpExecuteHost.ts', import.meta.url);
const outcomes = [];
for (const [name, addresses, allowed] of [
  ['public-ipv4', ['8.8.8.8'], true],
  ['public-ipv6', ['2001:4860:4860::8888'], true],
  ['fake-ip-range-low', ['198.18.0.189'], false],
  ['fake-ip-range-high', ['198.19.255.254'], false],
  ['mixed-public-and-fake', ['8.8.8.8', '198.18.0.189'], false],
  ['private-lan', ['192.168.1.1'], false],
]) {
  let transportCalls = 0, pinCalls = 0, unpinCalls = 0;
  const Probe = productionMotionMethods(file, ['singleHop', 'rejectPrivateNetworkTarget'], {
    HttpExecuteHost: { targetTails: new Map() },
    url: { URL: { parseURL: value => new URL(value) } },
    connection: {
      getAddressesByName: async () => addresses.map(address => ({ address })),
      addCustomDnsRule: async () => { pinCalls++; },
      removeCustomDnsRule: async () => { unpinCalls++; },
    },
    isPrivateNetworkTarget,
    errorMessageOf: error => error instanceof Error ? error.message : String(error),
    hilog: { warn() {} }, LOG_DOMAIN: 0,
  });
  const host = Object.assign(new Probe(), {
    assertWithinDeadline() {},
    async singleHopTransport() { transportCalls++; return { status: 200 }; },
  });
  let error;
  try {
    await host.singleHop('https://source.example/chapter', {}, {}, { kind: 'none' }, undefined, {});
  } catch (failure) { error = failure.message; }
  assert.equal(error === undefined, allowed, name);
  assert.equal(transportCalls, allowed ? 1 : 0, name);
  assert.equal(pinCalls, allowed ? 1 : 0, name);
  assert.equal(unpinCalls, pinCalls, name);
  outcomes.push({ name, syntheticDnsAnswers: addresses, allowed, transportCalls, pinCalls, unpinCalls, error });
}
console.log(JSON.stringify({
  evidenceLayer: 'actual production singleHop and DNS admission; platform resolver and transport boundaries controlled; no network or device',
  proves: 'fake-range DNS answers reject before transport; does not identify the user proxy or prove phone DNS results',
  outcomes,
}, null, 2));
