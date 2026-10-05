import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../../entry/src/main/ets/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
export const configurationSource = read('features/reading/ReaderTtsConfigurationHost.ts');
const dependencies = [read('app/ReaderOperationFacts.ts'), read('app/ReaderPersistedReceiptProjection.ts'),
  read('features/reading/ReaderOnlineTtsProfile.ts')];

/** Execute the production Host and pure contract leaves with erased imports;
 * no algorithm is recreated and no Harmony platform secret API is loaded. */
export async function loadConfigurationHost(source = configurationSource) {
  const combined = [...dependencies, source].map(value => value.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '')).join('\n');
  const js = stripTypeScriptTypes(combined);
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).ReaderTtsConfigurationHost;
}
export const ReaderTtsConfigurationHost = await loadConfigurationHost();
