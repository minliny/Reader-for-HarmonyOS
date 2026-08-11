#!/usr/bin/env node
import fs from 'node:fs';

const settings = fs.readFileSync('entry/src/main/ets/features/settings/SettingsPage.ets', 'utf8');
const index = fs.readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');

const checks = [
  ['settings exposes async cache callback', settings.includes('onClearCache: () => Promise<boolean>')],
  ['cache row is clickable', settings.includes('onRowClick: (): void => this.clearTextCache()')],
  ['cache action is explicitly text-only', settings.includes("'清理文字缓存'")],
  ['cache action observes state directly', settings.includes('this.inlineAction(this.cacheActionLabel, 66)')],
  ['duplicate taps are gated', settings.includes('cacheCleanupInFlight')],
  ['Index invokes canonical Core method', index.includes("request('cache.clear', { scope: 'cache' })")],
  ['Index validates returned scope', index.includes("result.data['scope'] !== 'cache'")],
  ['Settings wiring consumes result', index.includes('onClearCache: (): Promise<boolean> => this.clearTextCache()')],
];

for (const [label, passed] of checks) {
  if (!passed) {
    process.stderr.write(`settings cache cleanup contract: FAIL ${label}\n`);
    process.exit(1);
  }
}

process.stdout.write(`settings cache cleanup contract: PASS checks=${checks.length}\n`);
