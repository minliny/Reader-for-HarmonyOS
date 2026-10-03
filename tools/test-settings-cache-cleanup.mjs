#!/usr/bin/env node
import fs from 'node:fs';

const settings = fs.readFileSync('entry/src/main/ets/features/settings/SettingsPage.ets', 'utf8');
const index = fs.readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');
const gateway = fs.readFileSync('entry/src/main/ets/features/settings/SettingsCacheGateway.ts', 'utf8');
const host = fs.readFileSync('entry/src/main/ets/features/settings/SettingsHost.ets', 'utf8');
const owner = fs.readFileSync('entry/src/main/ets/features/settings/SettingsCacheCleanupOwner.ts', 'utf8');

const checks = [
  ['settings exposes async cache callback', settings.includes('onClearCache: () => Promise<SettingsCacheCleanupSnapshot | undefined>')],
  ['cache row is clickable', settings.includes('onRowClick: (): void => this.clearTextCache(capturedIdentity)')],
  ['cache action is explicitly text-only', settings.includes("'清理文字缓存'")],
  ['cache action observes state in concrete component tree', settings.includes('Text(this.cacheActionLabel)')],
  ['cache action does not cross builder argument boundary', !settings.includes('this.inlineAction(this.cacheActionLabel, 66)')],
  ['duplicate taps are gated', settings.includes('cacheCleanupInFlight')],
  ['typed gateway invokes canonical text-only method', gateway.includes("this.intents.execute('cache.clear', { scope: 'cache' }, { sourceId: 'cache', bookId: 'global-text' }") && !index.includes("request('cache.clear'")],
  ['typed gateway validates returned scope and all counts', gateway.includes("data['scope'] !== 'cache'") && gateway.includes('Number.isSafeInteger')],
  ['Settings wiring consumes typed result under captured presentation', index.includes('this.clearTextCache(generation, owner, mounting, host, identity)')],
  ['existing Host owns finite cleanup', host.includes('SettingsCacheCleanupOwner.forRuntime(owner') && index.includes('return host.clearCache(owner, current)')],
  ['lost ACK cannot replay command', owner.includes("this.snapshot.confirmation === 'unknown'") && owner.includes("canRetry: confirmation === 'undispatched'")],
];

for (const [label, passed] of checks) {
  if (!passed) {
    process.stderr.write(`settings cache cleanup contract: FAIL ${label}\n`);
    process.exit(1);
  }
}

process.stdout.write(`settings cache cleanup contract: PASS checks=${checks.length}\n`);
