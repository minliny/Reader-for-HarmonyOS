// Retired compatibility entry. Mutation source is preserved as inactive text.
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '--environment-check') {
    throw new Error('Retired one-time migration. Source: docs/history/worktrees/theme-consumer-migration/migrate-theme-consumers.cjs.txt. Replay only in its exact isolated historical checkout; current theme generation uses tools/generate-theme-registry.mjs.');
  }
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  console.log(JSON.stringify({ status: 'PASS', etsLoader: resolveEtsLoaderRoot() }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
