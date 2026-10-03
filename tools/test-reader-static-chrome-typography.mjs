import { execFileSync } from 'node:child_process';
for (const probe of ['test-conventional-typography.mjs', 'test-conventional-typography-sdk.mjs']) {
  process.stdout.write(execFileSync(process.execPath, [new URL(`./${probe}`, import.meta.url).pathname,
    '--fixture=reader-static-chrome-typography-baseline.json', ...(process.argv.includes('--verify-migration-source') ? ['--verify-migration-source'] : [])], { encoding: 'utf8' }));
}
console.log('PASS reader static chrome: 230 carriers; eleven dynamic-size consumers remain explicitly OPEN for the bounded-motion batch');
