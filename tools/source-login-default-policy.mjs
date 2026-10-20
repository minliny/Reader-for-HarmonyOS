// Reviewed distribution decisions keyed by exact source identity. Login URLs,
// cookie jars and token references alone do not establish an account gate.
import assert from 'node:assert/strict';
import { ruleFingerprint } from './source-supply-lib.mjs';

export const SOURCE_LOGIN_DEFAULT_POLICY = 'reader-login-defaults/1';
export const SOURCE_LOGIN_DEFAULT_VERSION = 7;
// [identity, login scope, evidence field, short declaration, accepted rules]
const accountGates = [
  ['https://bbs.yamibo.com', 'source', 'bookSourceComment', '需先登录百合会账号后使用',
    ['2cc8ac9375a95526a846320991528a71afb7f79736d7dce092ddf341a3e2bacb', '30f64a0fedf9326febc576dfac996be2dbf0c71312e78cce7e19760bc335e42c']],
  ['https://manhuapica.com', 'source', 'bookSourceComment', '登录使用，没有账号就去注册',
    ['b96360600f30acc3aa0ef5e5112894cdf97eca99bbac0a74dde804ff4c88ec07']],
  ['https://pan.baidu.com', 'personal-cloud-files', 'bookSourceComment', '需登录',
    ['9c896d982e2294e6ee6565084630204a1f898f9d3d59d315d5ed8da92298504b']],
  ['https://www.jianguoyun.com', 'personal-cloud-files', 'bookSourceComment', '需登录',
    ['2f1053a03b33c40dd57fb6292a2645b26f4c3432be5ccbc11be96e63044a19ef']],
  ['https://www.lucifer-club.com/', 'source', 'bookSourceComment', '需要ID登录',
    ['e9ae1214fa50d01713b7b601441dfb2e9bc3fcd0617c32b7b7d0dfd29c0ce990']],
  ['https://www.lucifer-club.com', 'source', 'header', '使用前请先登录！',
    ['6b9480ce0350fe67ba1ab01539ceac4b2353d034d75e2c2d1eb1ea533b3f206f']],
  ['https://xn--pxtr7m.com', 'source', 'bookSourceComment', '需登录。注册需要邀请码。',
    ['96cab09a5c81ef3da7015f24aceace5c1d0a2de572e1205e901e1199a1f29a31']],
  ['https://www.yoduzw.com', 'search', 'bookSourceComment', '需登录才可搜索',
    ['e97adc3de88176e2be33dfe2672e9cc3d08ce6a0a5140da7a772b2225f8c032d', '922d3824d7d16c8b0dcd348c257aabc30f7603695d501e147e7ee16fb50eb30c']],
  ['https://www.yodu.org##破冰', 'search', 'bookSourceComment', '登录搜索',
    ['1cbf5ae3942ed3275f14981c542e7fbc44673fb235f713a713be5d8ab33f0691']],
  ['https://www.yodu.org', 'search', 'bookSourceComment', '搜索需登录',
    ['dd717b4c4b97d94aac77989376707018fbf4b5ecf00466a40fcf4a7656c4eb2c']],
  ['https://www.po18.tw', 'toc', 'bookSourceComment', '需登录才能加载目录',
    ['e82f7e49f09e5128cb46682bb069d6ad2672ccbcac63bc380af33d38a200d7d6']],
];

export const SOURCE_LOGIN_DEFAULT_DECISIONS = [
  ...accountGates.map(([sourceId, scope, evidenceField, evidence, fingerprints]) => ({
    sourceId, scope, evidenceField, evidence, fingerprints, requirement: 'account-required',
  })),
  {
    sourceId: 'https://66shuba.com', scope: 'content', requirement: 'undetermined',
    reason: 'anonymous-content-http-403', evidenceField: 'local-runtime-probe',
    evidence: '2026-10-06: 呢喃诗章、终宋首章无登录凭据均 HTTP 403；登录后恢复尚未验证。',
    fingerprints: ['fa759f5fbf924b1a0ca073891f987de2d5c8f19e886cc3f2eb2f06215d007699'],
  },
];
const byId = new Map(SOURCE_LOGIN_DEFAULT_DECISIONS.map(decision => [decision.sourceId, decision]));

export function assertSourceLoginDefault(source) {
  const decision = byId.get(source.bookSourceUrl);
  if (!decision) return;
  assert.equal(source.enabled, false, `${decision.sourceId}: reviewed login/access gate must default off`);
  assert.equal(source.defaultEnabled, false, `${decision.sourceId}: reviewed login/access gate must default off`);
  if (Object.hasOwn(source, 'enabledExplore')) assert.equal(source.enabledExplore, false);
  assert.ok(source.builtinVersion >= SOURCE_LOGIN_DEFAULT_VERSION);
  assert.equal(source.provenance?.defaultStateCorrection?.policy, SOURCE_LOGIN_DEFAULT_POLICY);
  assert.equal(source.provenance.defaultStateCorrection.version, 1);
  assert.equal(source.provenance.defaultStateCorrection.preserveUserFields, true);
  assert.equal(source.provenance.defaultStateCorrection.requirement, decision.requirement);
  assert.equal(source.provenance.defaultStateCorrection.scope, decision.scope);
  assert.equal(source.provenance.defaultStateCorrection.previousRuleFingerprint, source.ruleFingerprint);
  assert.ok(decision.fingerprints.includes(ruleFingerprint(source)),
    `${decision.sourceId}: changed rules require a new login/default review`);
}

export function applySourceLoginDefaultPolicy(sources) {
  const matched = new Set();
  let records = 0;
  for (const source of sources) {
    const decision = byId.get(source.bookSourceUrl);
    if (!decision) continue;
    const fingerprint = ruleFingerprint(source);
    assert.ok(decision.fingerprints.includes(fingerprint),
      `${decision.sourceId}: changed rules require a new login/default review`);
    assert.equal(source.ruleFingerprint, fingerprint, `${decision.sourceId}: stale rule fingerprint`);
    assert.ok(source.builtinVersion === 6 || source.builtinVersion === SOURCE_LOGIN_DEFAULT_VERSION,
      `${decision.sourceId}: review a newer bundle revision before changing its defaults`);
    source.enabled = false;
    source.defaultEnabled = false;
    if (Object.hasOwn(source, 'enabledExplore')) source.enabledExplore = false;
    source.builtinVersion = SOURCE_LOGIN_DEFAULT_VERSION;
    source.provenance.defaultStateCorrection = {
      version: 1, policy: SOURCE_LOGIN_DEFAULT_POLICY, appliedAt: '2026-10-06',
      previousBuiltinVersion: 6, previousRuleFingerprint: fingerprint,
      fields: ['enabled', 'defaultEnabled', 'enabledExplore'], preserveUserFields: true,
      requirement: decision.requirement, scope: decision.scope,
      reason: decision.reason ?? 'account-required',
      evidenceField: decision.evidenceField, evidence: decision.evidence,
      verification: decision.requirement === 'account-required' ? 'source-rule-declaration' : 'anonymous-local-runtime-probe',
    };
    assertSourceLoginDefault(source);
    matched.add(source.bookSourceUrl);
    records += 1;
  }
  assert.equal(matched.size, byId.size, 'reviewed login/access identities must remain in the collection');
  return { identities: matched.size, records };
}
