import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as state from '../../entry/src/main/ets/features/reading/application/ReaderTtsPreferencesState.ts';
import {selectedProductionMethods, selectedProductionComponentCallback} from './selected-production-methods.mjs';

export {state};
export const lreFile = new URL('../../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);
export const gatewayFile = new URL('../../entry/src/main/ets/features/reading/application/ReaderTtsPreferencesGateway.ts', import.meta.url);
export const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
export const settle = async () => {for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};

/** Entire unchanged gateway; each fixture has its own file domain. Only SDK
 * Preferences, Theme recovery and Runtime identity are finite delivery ports. */
export function preferenceGateway(base=state.createDefaultReaderTtsPreferencesSnapshot(), source=readFileSync(gatewayFile,'utf8')) {
  const events=[], cache=new Map([['snapshot',JSON.stringify(base)]]), durable=new Map(cache);
  const runtime={getUIAbilityContext:()=>({})};let active=runtime, barrier=async()=>{},storeGate,readGate,putGate,flushGate,failRead=false,failPut=false,failFlush;
  const store={async get(key,fallback){events.push(['get']);if(readGate){const gate=readGate;readGate=undefined;await gate.promise;}if(failRead){failRead=false;throw Error('controlled read failure');}return cache.get(key)??fallback;},
    async put(key,value){events.push(['put',JSON.parse(value)]);if(putGate){const gate=putGate;putGate=undefined;await gate.promise;}
      if(failPut){failPut=false;throw Error('controlled put before effect');}cache.set(key,value);},
    async flush(){events.push(['flush']);if(flushGate){const gate=flushGate;flushGate=undefined;await gate.promise;}
      if(failFlush==='before'){failFlush=undefined;throw Error('controlled flush before effect');}
      for(const [key,value] of cache)durable.set(key,value);
      if(failFlush==='after'){failFlush=undefined;throw Error('controlled flush lost ACK');}}};
  const body=stripTypeScriptTypes(source.slice(source.indexOf('const READER_TTS_PREFERENCES_NAME'))).replace('export class ','class ');
  const Gateway=new Function(...Object.keys(state),'ReaderThemeHost','ReaderRuntimeOwner','preferences',body+';return ReaderTtsPreferencesGateway;')
    (...Object.values(state),{prepareUserChange:()=>barrier()},{isCurrent:owner=>owner===active},{getPreferences:async()=>{
      if(storeGate){const gate=storeGate;storeGate=undefined;await gate.promise;}return store;}});
  const owner=new Gateway(runtime);
  return {owner,Gateway,events,cache,durable,runtime,store,setBarrier:fn=>{barrier=fn;},hangRead:gate=>{readGate=gate;},
    hangStore:gate=>{storeGate=gate;},hangPut:gate=>{putGate=gate;},hangFlush:gate=>{flushGate=gate;},failRead:()=>{failRead=true;},
    failPut:()=>{failPut=true;},failFlush:when=>{failFlush=when;},
    remount(){active={...runtime};return new Gateway(active);},retire(){active=undefined;},
    saved:()=>JSON.parse(durable.get('snapshot')),puts:()=>events.filter(event=>event[0]==='put').map(event=>event[1])};
}

const methods=['isMountedToken','isSessionActive','nextTtsPreferenceMutationGeneration','captureTtsPreferenceOwner','captureTtsPreferenceAdmission',
  'ttsPreferencesSnapshot','copyTtsPreferencesSnapshot','acceptTtsPreferencesPatch','persistTtsPreferencesPatch','persistTtsPreferences',
  'notifyTtsPreferencePending','retryPendingTtsPreferences','setReaderPreferenceNotice','settleReaderPreferenceNotice','retryReaderPreferenceNotice',
  'loadTtsPresentationMetadata','admitTtsPreferences','ttsWindowAwakeRequested','reconcileTtsWindowAwake','windowPolicyFor','applyReaderWindowPolicy',
  'changeTtsAllowMixing','changeTtsBackgroundPlayback','changeTtsKeepScreenOn','changeTtsFailurePolicy','changeTtsFollowHighlight',
  'changeTtsPauseOnInterruption','changeTtsVoice'];

/** Actual LRE declarations and actual normal Panel callback expressions.
 * A policy port observes the final requested keep-awake argument; it does not
 * claim an OS window effect. Tests may supply the entire real Coordinator. */
export function preferenceReader(gateway, {coordinator, nativeHost, file=lreFile, windowFailure=false}={}) {
  const events=[],window=[];
  const native=coordinator??{setAllowMixing:async value=>{events.push(['mixing',value]);return true;},
    setVoice:async(language,person)=>{events.push(['voice',language,person]);return true;},
    setVoiceForNextSpeech:(language,person)=>events.push(['next-voice',language,person]),
    setPauseOnInterruption:value=>events.push(['pause',value]),setBackgroundPlayback:value=>events.push(['background',value]),
    setFailurePolicy:value=>events.push(['failure',value]),pauseForBackground:async()=>events.push(['background-pause'])};
  const Type=selectedProductionMethods(file,'ReadingExperience',methods,{...state,
    ReaderRuntimeOwner:{current:()=>({getTtsHost:()=>nativeHost})},
    AppStorage:{setOrCreate(){}},hilog:{error(){}},
    ReaderWindowPolicy:class {constructor(direction,keep){this.keepScreenOn=keep;this.direction=direction;}},
    ReaderWindowCoordinator:{isTabletDevice:()=>false,requestReaderWindowPolicy:async policy=>{window.push(policy);if(windowFailure)throw Error('controlled window refusal');}},
  });
  const owner=Object.assign(new Type(),{mounted:true,lifecycleToken:1,exitRequested:false,sourceId:'source-1',bookId:'book-1',
    appForeground:true,windowChromeActive:true,screenAwakeKeepScreenOn:false,ttsCoordinator:native,ttsPreferencesGateway:gateway,
    ttsPreferenceMutationGeneration:0,ttsPreferenceSavedGeneration:0,ttsPreferenceOverrides:{},ttsPreferenceBase:undefined,
    ttsVoicePreferenceGeneration:0,ttsMixingPreferenceGeneration:0,ttsVoicePreferencePending:false,ttsMixingPreferencePending:false,
    ttsLanguage:'zh-CN',ttsPerson:0,ttsPauseOnInterruption:true,ttsAllowMixing:false,ttsBackgroundPlayback:true,
    ttsKeepScreenOn:false,ttsFailurePolicy:'stop',ttsFollowHighlight:true,ttsState:{status:'idle'},
    ttsVoiceOptions:[{language:'zh-CN',person:0},{language:'en-US',person:7}],
    ttsPreferencesRecovery:{message:'',visible:false,canRetry:false,generation:0},
    readerSettingsSnapshot:{screenDirection:'auto'},controlsPresentedForWindow:()=>false,
    requireTtsConfigurationHost:()=>({refreshMetadata:async()=>{}}),
    followTtsPage:state=>events.push(['follow',state.status]),invalidateTtsPageFollow:()=>events.push(['invalidate-follow']),
    logTtsFailure:(...args)=>events.push(['diagnostic',...args])});
  const callback=name=>selectedProductionComponentCallback(file,'ReaderControlPanel',name,owner);
  return {owner,coordinator:native,events,window,callback,
    state(next){const previous=owner.ttsWindowAwakeRequested();owner.ttsState={...owner.ttsState,status:next};owner.reconcileTtsWindowAwake(previous);},
    assertSaved(){assert.deepEqual(owner.ttsPreferencesSnapshot(),gateway.writeFacts().saved);}};
}
