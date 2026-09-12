import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const owner = readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const ability = readFileSync('entry/src/main/ets/entryability/EntryAbility.ets', 'utf8');

assert.match(owner,
  /current === undefined \|\| current\.state === 'closing' \|\| current\.state === 'closed'[\s\S]*new ReaderRuntimeOwner\(context, predecessorClose\)/,
  'a recreated Ability must receive a fresh owner instead of a closing singleton');
assert.match(owner, /abilityLeases \+= 1/);
assert.match(owner, /async release\(\): Promise<void>[\s\S]*abilityLeases -= 1[\s\S]*await this\.close\(\)/,
  'overlapping Ability instances must release a shared runtime only after the final lease');
assert.match(owner, /await this\.predecessorClose[\s\S]*await this\.startRuntime\(\)/,
  'a successor must wait for predecessor Host teardown before starting');
assert.match(owner, /ReaderRuntimeOwner\.instance === this[\s\S]*ReaderRuntimeOwner\.instance = undefined/,
  'an old close completion must not erase a newer singleton');
assert.match(ability, /private runtimeOwner: ReaderRuntimeOwner \| undefined/);
assert.match(ability, /this\.runtimeOwner = owner/);
assert.match(ability, /const owner = this\.runtimeOwner;[\s\S]*owner\?\.release\(\)/,
  'each Ability must release the exact owner it acquired');
assert.doesNotMatch(ability, /ReaderRuntimeOwner\.current\(\)\.close\(\)/,
  'an old Ability must never close whichever singleton happens to be current');

console.log('ReaderRuntimeOwner Ability lease lifecycle: PASS');
