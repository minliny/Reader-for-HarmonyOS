import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source=name=>stripTypeScriptTypes(readFileSync(new URL(`../entry/src/main/ets/app/${name}.ts`,import.meta.url),'utf8')
  .replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
const bytes=new Uint8Array([1,2,3,4]),requests=[];
let network=async()=>({status:200,bytes}),createPlayer;
const HttpExecuteHost={instance:{executeBytes(...args){requests.push(args);return network();}}};
const Tts=new Function('HttpExecuteHost','media','audio','hilog','ReaderHttpTtsGateway','isCrossOriginSensitiveHeader',
  source('HarmonyHttpTtsHost')+';return HarmonyHttpTtsHost;')(HttpExecuteHost,{createAVPlayer:()=>createPlayer()},
  {StreamUsage:{STREAM_USAGE_AUDIOBOOK:1}},{error(){}},class{},()=>false);
const Image=new Function('HttpExecuteHost',source('ReadingBodyImageHost')+';return ReadingBodyImageHost;')(HttpExecuteHost);
const tts=new Tts({}),image=Image.instance,descriptor={url:'https://audio.test/a',method:'GET',headers:{}};
assert.equal(await tts.fetchAudio(descriptor,1),bytes);
assert.equal(await image.fetchRequestBytes(descriptor),bytes);
assert.ok(requests.every(args=>args[1]===16*1024*1024),'both consumers pass their cap before transport dispatch');
assert.equal(requests[0][0].httpsOnly,true);
const pcm=tts.normalizeAudioBytes(bytes,{format:'pcm',sampleRate:16000,channels:1});
assert.equal(pcm.length,48);assert.equal(new TextDecoder().decode(pcm.subarray(0,4)),'RIFF');assert.deepEqual(pcm.subarray(44),bytes);
assert.throws(()=>tts.normalizeAudioBytes(new Uint8Array(16*1024*1024),{format:'pcm',sampleRate:16000,channels:1}),/allowed range/);
let waiting=deferred();network=()=>waiting.promise;
let current=true;const lateImage=image.fetchRequestBytes(descriptor,()=>current);current=false;
waiting.resolve({status:200,bytes});await assert.rejects(lateImage,/cancelled|stale|superseded/);
waiting=deferred();const lateAudio=tts.fetchAudio(descriptor,1);await Promise.resolve();await Promise.resolve();
tts.networkGeneration++;waiting.resolve({status:200,bytes});await assert.rejects(lateAudio,/cancelled/);

const player=()=>({state:'prepared',released:0,played:0,on(){},async stop(){},async prepare(){},async play(){this.played++;},async release(){this.released++;}});
network=async()=>({status:200,bytes});tts.configId=1;tts.gateway={async buildRequest(){return descriptor;}};
waiting=deferred();let creating=false;createPlayer=()=>{creating=true;return waiting.promise;};
const speech=tts.speak({requestId:'old',text:'词',rate:1});
for(let i=0;i<20&&!creating;i++)await Promise.resolve();assert.equal(creating,true);
await tts.stop();const old=player();waiting.resolve(old);await speech;
assert.equal(old.released,1);assert.equal(old.played,0);assert.equal(tts.player,undefined);
const releaseWait=deferred(),releasing=player();releasing.stop=()=>releaseWait.promise;
tts.player=releasing;tts.audioBytes=bytes;const release=tts.releasePlayer();
const newer=player(),newBytes=new Uint8Array([5,6]);tts.player=newer;tts.audioBytes=newBytes;
releaseWait.resolve();await release;assert.equal(tts.player,newer);assert.equal(tts.audioBytes,newBytes);
tts.currentRequestId='new';tts.handlePlayerState(newer,'new','completed');
for(let i=0;i<6;i++)await Promise.resolve();
assert.equal(newer.released,1);assert.equal(tts.audioBytes,undefined);
console.log('PASS actual image/TTS consumers without Base64 API, PCM headroom, late network/player rejection, old-release race and completion resource release');
