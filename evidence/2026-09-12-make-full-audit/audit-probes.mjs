import { readFileSync, writeFileSync } from 'node:fs';
import { productionMotionMethods } from '../../tools/lib/reader-motion-method-probe.mjs';
import { sampleReaderControlTts } from '../../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
const source = name => readFileSync(new URL(`../../entry/src/main/ets/features/reading/${name}`, import.meta.url), 'utf8');
const ref=readFileSync(new URL('../2026-09-11-make-style-parity/tts-reference/src/PhoneScreen.tsx',import.meta.url),'utf8');
const modalRef=ref.slice(ref.indexOf('function OnlineTtsModal('),ref.indexOf('function EngineModule('));
const modalNative=source('ReaderTtsConfigOverlay.ets');
const expectedFields=[...modalRef.matchAll(/<Field label="([^"]+)"/g)].map(m=>m[1]);
expectedFields.push('音频格式');
const fieldAudit=expectedFields.map(label=>({label,renderedByNative:modalNative.includes(`Text('${label}')`)}));
const Host=productionMotionMethods(new URL('../../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['changeTtsVoice']);
const failures=[];let persisted=0;
const host=Object.assign(new Host(),{ttsLanguage:'zh-CN',ttsPerson:0,
  ttsVoiceOptions:[{language:'zh-CN',person:0,label:'Original'},{language:'zh-CN',person:1,label:'Candidate'}],
  ttsCoordinator:{setVoice:async()=>{throw new Error('audit simulated voice rejection');}},
  persistTtsPreferences(){persisted++;},logTtsFailure:(kind,e)=>failures.push({kind,message:e.message})});
host.changeTtsVoice('zh-CN',1); for(let i=0;i<8;i++) await Promise.resolve();
const quick=sampleReaderControlTts(0,916/3.5);
const report={kind:'read-only audit observations; successful execution does not mean design acceptance',
  onlineFormFields:fieldAudit,onlineFormatOptions:['MP3','WAV','PCM'],nativeFieldCount:fieldAudit.filter(f=>f.renderedByNative).length,
  voiceFailure:{trigger:'production changeTtsVoice method; setVoice rejects',originalPerson:0,requestedPerson:1,projectedPersonAfterFailure:host.ttsPerson,persistedCalls:persisted,failures,conclusion:host.ttsPerson===1?'UI selection remains optimistic after real owner failure; no rollback in this production method':'unexpected result'},
  quickNarrowStatus:{referenceQuickWidth:286,observedVmContentWidthVp:916/3.5,actorWidth:quick.quickPlaybackLabel.width,
    remainingTextWidth:quick.quickPlaybackLabel.width-34-9-5-4,
    visualEvidence:'../2026-09-11-make-style-parity/vm-ui/reader-control-make-54-v10-tts-retry.png',conclusion:'VM idle status visibly truncates to 未…; fixed icon/dot/gaps consume label width at this viewport.'}
};
writeFileSync(new URL('./audit-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
