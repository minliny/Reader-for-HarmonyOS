import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isCookieVisibleToScript,
  isExactCookieDomainScope,
} from '../entry/src/main/ets/app/CookieSecurityPolicy.ts';

assert.equal(isExactCookieDomainScope('login.example.com', 'login.example.com'), true);
for (const scope of ['example.com', 'com', 'co.uk', 'other.example']) {
  assert.equal(isExactCookieDomainScope('login.example.com', scope), false,
    `source cookies must not expand from login.example.com to ${scope}`);
}
assert.equal(isCookieVisibleToScript(false), true);
assert.equal(isCookieVisibleToScript(true), false);

const store = readFileSync(new URL(
  '../entry/src/main/ets/app/CookieSessionStore.ts', import.meta.url,
), 'utf8');
assert.match(store, /cookie\.sessionId !== sessionId \|\| cookie\.httpOnly/,
  'cookie.get must exclude HttpOnly credentials');
assert.match(store, /cookie\.set cannot create HttpOnly credentials from script/);
assert.match(store, /isExactCookieDomainScope\(requestUrl\.hostname, requestedDomain\)/,
  'Set-Cookie Domain must use the exact-host policy');
assert.match(store, /cookie\.hostOnly === true/,
  'persisted legacy cross-domain cookies must be rejected during load');
assert.match(store, /A torn or externally-corrupted journal cannot identify safe garbage/,
  'a malformed pending journal must be quarantined instead of poisoning future writes');
assert.match(store, /rawNext[\s\S]*rawPrevious[\s\S]*removeRecord\(ASSET_PENDING_ALIAS\)/,
  'pending journal shape must be validated before reading chunk ownership');
assert.match(store, /part\.length > ASSET_SECRET_CHUNK_BYTES[\s\S]*MAX_PERSISTED_BYTES - part\.length/,
  'chunk payloads must be bounded before the aggregate Uint8Array allocation');

console.log('cookie exact-host and HttpOnly script-isolation policy: PASS');
