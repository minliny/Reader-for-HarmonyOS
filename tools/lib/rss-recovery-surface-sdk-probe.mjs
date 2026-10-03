import {readFileSync} from 'node:fs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {foundationControls} from './reader-foundation-control-probe.mjs';

// A test composition of actual emitted production children. No substitute
// component or recovery algorithm; the native scheduling boundary stays open.
export function rssRecoverySurfaceSdk(options={}) {
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true,typographyRoles:options.typographyRoles});
 if(options.foundation!==false){
  const controls=foundationControls();Object.assign(sdk.deps,controls.dependencies);
  const oldEnter=sdk.hooks.onObserverEnter,newEnter=controls.hooks.onObserverEnter;
  sdk.hooks.onObserverEnter=(...args)=>{oldEnter?.(...args);newEnter?.(...args);};
  Object.assign(sdk.childSources,controls.hooks.childSources);sdk.hooks.lifecycleChildren=true;
  const flush=sdk.properties.flush;sdk.properties.flush=()=>{flush();controls.properties.flush();};
 }
 const source=readFileSync(new URL('../../entry/src/main/ets/features/rss/RssOriginalRecoverySurface.ets',import.meta.url),'utf8');
 sdk.childSources.RssOriginalRecoverySurface=source;
 sdk.deps.RssOriginalRecoverySurface=createReaderBuilderProbe(source,boundedMembers(source),sdk.deps,sdk.hooks).Component;
 return sdk;
}
