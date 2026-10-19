import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function preferences() {
 const {createDefaultReaderTtsPreferencesSnapshot,normalizeReaderTtsPreferencesSnapshot,isReaderTtsVoiceInstalled}=await import('../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts');
 const fallback=createDefaultReaderTtsPreferencesSnapshot();assert.deepEqual(fallback,{version:1,language:'zh-CN',person:0,pauseOnInterruption:true,allowMixing:false,failurePolicy:'stop',followHighlight:true,backgroundPlayback:true,keepScreenOn:false});
 assert.deepEqual(normalizeReaderTtsPreferencesSnapshot({version:1,language:' en-US ',person:7,pauseOnInterruption:false,allowMixing:true,failurePolicy:'skip',followHighlight:false,backgroundPlayback:true,keepScreenOn:false}),{version:1,language:'en-US',person:7,pauseOnInterruption:false,allowMixing:true,failurePolicy:'skip',followHighlight:false,backgroundPlayback:true,keepScreenOn:false});
 assert.deepEqual(normalizeReaderTtsPreferencesSnapshot({version:1,language:'',person:-1,pauseOnInterruption:'invalid',allowMixing:'invalid',failurePolicy:'retry',followHighlight:'invalid'}),fallback);
 for(const status of ['INSTALLED',' installed ',undefined])assert.equal(isReaderTtsVoiceInstalled(status),true);assert.equal(isReaderTtsVoiceInstalled('GA'),false);
}
async function systemVoice() {
 const {isReaderTtsVoiceInstalled}=await import('../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts');
 const source=readFileSync(new URL('../entry/src/main/ets/app/HarmonySystemTtsHost.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
 const requests=[],spoken=[];let voices=[];
 const textToSpeech={async createEngine(params){requests.push(params);if(params.language==='unavailable')throw Error('not installed');return {setListener(){},speak(text,params){spoken.push({text,params});},stop(){},shutdown(){}};},async listVoices(){return voices;}};
 const Host=new Function('textToSpeech','audio','hilog','harmonyTtsAudioSessionLease','isReaderTtsVoiceInstalled','errorMessageOf',stripTypeScriptTypes(source)+';return HarmonySystemTtsHost;')(textToSpeech,{}, {error(){}},{createOwner:()=> 'system',deactivate:async()=>{}},isReaderTtsVoiceInstalled,e=>e.message);
 const host=new Host();
 voices=[{language:'en-US',person:2,status:'GA',description:'downloadable',style:''},{language:'zh-CN',person:0,status:'INSTALLED',description:'已安装',style:''},{language:'zh-CN',person:0,status:'INSTALLED',description:'重复',style:''},{language:' ',person:1,status:'INSTALLED',description:'bad',style:''}];
 assert.deepEqual(await host.listVoices(),[{language:'zh-CN',person:0,label:'已安装'}]);voices=[];assert.deepEqual(await host.listVoices(),[{language:'zh-CN',person:0,label:'系统默认'}]);
 await host.speak({requestId:'r1',text:'正文',language:'unavailable',person:7,rate:1,pitch:1});assert.deepEqual(requests.map(x=>[x.language,x.person]),[['unavailable',7],['zh-CN',0]]);
 assert.equal(spoken[0].params.extraParams.languageContext,'zh-CN','fallback uses effective engine language, not unavailable requested language');
 await host.speak({requestId:'r2',text:'续读',language:'unavailable',person:7,rate:1,pitch:1});assert.equal(requests.length,2,'same requested voice reuses the already-effective default engine');
 await host.close();
}
const cases={preferences,'system-voice':systemVoice};
for(const id of selectContractCases({preferences:'Pure defaults, normalization and installed voice admission','system-voice':'Actual system Host list/engine fallback/effective language with controlled speech Kit'})){await cases[id]();recordContractCasePass(id);}
