import { localFilePath } from './lib/tool-environment.mjs';
import { execFileSync } from 'node:child_process';
for (const probe of ['test-conventional-typography.mjs', 'test-conventional-typography-sdk.mjs']) {
  process.stdout.write(execFileSync(process.execPath, [localFilePath(new URL(`./${probe}`, import.meta.url)),
    '--fixture=reader-static-chrome-typography-baseline.json', ...(process.argv.includes('--verify-migration-source') ? ['--verify-migration-source'] : [])], { encoding: 'utf8' }));
}
console.log('PASS reader static chrome: 230 baseline carriers; audited finite-state successors are accepted without freezing business sources');
