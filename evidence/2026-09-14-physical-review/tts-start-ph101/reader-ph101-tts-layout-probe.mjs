import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-control-builder-probe.mjs';
import * as geometry from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as tts from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderTtsState.ts';
const path = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets';
const source = readFileSync(path, 'utf8');
const methods = ['p', 'frame', 'effectiveRate', 'onlineServicePage', 'isHttpEngineSelected', 'sharedInput', 'fullInput', 'hasActiveQueue', 'isActivelySpeaking', 'transport', 'roundControl', 'quickLabel', 'quickLabelActor', 'playbackLabel', 'controlText'];
const {owner} = createReaderBuilderProbe(source, methods, {...geometry, ...actors, ...tts, readerTtsPlayGradientStart: () => '#000000'});
Object.assign(owner, {motionProgress:0, availableWidth:286, availableHeight:190, cachedProgress:-1, cachedWidth:-1, cachedRate:-1, cachedSeek:-1, cachedOnlinePage:false, state:{rate:1,status:'ready',totalSlices:0},ratePreview:-1,engine:'system',serviceTab:'',serviceBusy:false,appScheme:'day',interactionEnabled:true});
for(const kind of ['previous','toggle','stop','next']) owner.roundControl(kind);
owner.quickLabel('playback');
const shape = () => [...owner.nodes.values()].filter(n=>n.position).map(n=>({type:n.type, position:n.position,width:n.width,height:n.height}));
const baseline=shape();
for(const status of ['probing','ready','preparing','playing','paused','resuming','stopping','error','failed','ready']) {
  owner.state={rate:1,status,totalSlices: status==='ready'?0:90,errorMessage:status==='error'?'engine failed':undefined};
  owner.replay();
  assert.deepEqual(shape(),baseline,`native emitted x/y/size remains fixed for status=${status}`);
  console.log(JSON.stringify({status, quickLabel:owner.playbackLabel(), playback:owner.frame().playback, controls:baseline}));
}
console.log('PASS native SDK-emitted Quick TTS builders: status and queue/error changes do not translate or resize any positioned playback child. Scope excludes native measure/paint and launch parent.');
