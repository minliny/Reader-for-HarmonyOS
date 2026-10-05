import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const { ReadingOfflineGateway } = await import('../../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const { RemoteReadingFlowGateway } = await import('../../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { sameRemoteSessionEvidence, canAppendRemoteReadingCatalog } = await import('../../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const { errorMessageOf } = await import('../../entry/src/main/ets/app/ErrorMessage.ts');
const source = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReadingPrefetchHost.ts',import.meta.url),'utf8');
/** Complete original feature owner and Gateways. Runtime installation is the
 * only authority seam; IO, timing and native layout are separate fixtures. */
export function readingPrefetchOwnerProbe(readCurrent, overrides={}) {
  const Runtime=runtimeOwnerIdentityProbe(readCurrent);
  const deps={ReaderRuntimeOwner:Runtime,ReadingOfflineGateway,RemoteReadingFlowGateway,sameRemoteSessionEvidence,canAppendRemoteReadingCatalog,errorMessageOf,...overrides};
  const Host=new Function(...Object.keys(deps),stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'')).replace(/\bexport /g,'')+';return ReadingPrefetchHost;')(...Object.values(deps));
  return {ReadingPrefetchHost:Host,ReaderRuntimeOwner:Runtime};
}
