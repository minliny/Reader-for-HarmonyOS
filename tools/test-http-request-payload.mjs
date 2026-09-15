import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';

const app=new URL('../entry/src/main/ets/app/',import.meta.url);
const production=stripTypeScriptTypes(readFileSync(new URL('HttpExecuteHost.ts',app),'utf8').replace(/^import[\s\S]*?;\n/gm,'')).replace(/^export /gm,'');
const sdk=readFileSync(new URL('../entry/vendor/core-harmony/Index.ts',import.meta.url),'utf8');
const sharedFunction=sdk.slice(sdk.indexOf('export function encodeSharedText('),sdk.indexOf('export async function runHarmonyNapiSmoke('));
const calls=[];
const nativePath=process.env.READER_NATIVE_ENCODER;
const native=nativePath?createRequire(import.meta.url)(nativePath):{encodeText(text,charset,maxBytes){
 let bytes;
 if(['utf-8','utf8'].includes(charset.toLowerCase()))bytes=Buffer.from(text,'utf8');
 else if(charset==='gbk'){
  const fixtures={'':'','中文':'d6d0cec4','name':'6e616d65','值':'d6b5'};
  assert.ok(Object.hasOwn(fixtures,text),'only fixed GBK fixture bytes are mocked');bytes=Buffer.from(fixtures[text],'hex');
 }else throw new Error('unsupported fixture charset');
 if(bytes.length>maxBytes)throw new Error('encoded request exceeds byte limit');
 return Uint8Array.from(bytes);
}};
const shared=new Function('nativeReaderCore',stripTypeScriptTypes(sharedFunction).replace('export function','function')+';return encodeSharedText;')(native);
const encodeSharedText=(text,charset,maxBytes)=>{calls.push({inputLength:text.length,charset,maxBytes});return shared(text,charset,maxBytes);};
let optionsSeen,destroyed=0;
const http={RequestMethod:{POST:'POST'},HttpDataType:{ARRAY_BUFFER:2},InterceptorType:{REDIRECTION:1},
 HttpInterceptorChain:class{addChain(){return true;}apply(){return true;}},
 createHttp:()=>({async request(_url,options){optionsSeen=options;return{responseCode:200,result:new ArrayBuffer(0),header:{}};},destroy(){destroyed++;}})};
const util={TextEncoder:class{encode(){return undefined;}}}; // Reproduce the observed VM encoder behavior.
const Host=new Function('http','util','encodeSharedText','hilog',production+';return HttpExecuteHost;')(http,util,encodeSharedText,{error(){},warn(){}});
const host=new Host(),limit=16*1024*1024;
async function post(body,charset){const d={deadlineAt:Date.now()+10000,cancelled:false,activeRequest:null};
 try{return await host.singleHopTransport('https://source.example/fixture',{wireMethod:'POST',enumMethod:'POST'}, {},body,charset,d);}
 finally{assert.equal(d.activeRequest,null);}}

for(const [text,charset,hex] of [['',undefined,''],['中文',undefined,'e4b8ade69687'],['中文','UTF8','e4b8ade69687'],['中文','gbk','d6d0cec4'],['','gbk','']]){
 await post({kind:'text',text},charset);assert.ok(optionsSeen.extraData instanceof ArrayBuffer);
 assert.equal(Buffer.from(optionsSeen.extraData).toString('hex'),hex);
}
for(const [fields,charset,wire] of [[[],undefined,''],[[['name','']],undefined,'name='],[[['name','中文']],undefined,'name=%E4%B8%AD%E6%96%87'],[[['name','中文']],'gbk','name=%D6%D0%CE%C4']]){
 await post({kind:'form',fields},charset);assert.equal(Buffer.from(optionsSeen.extraData).toString('ascii'),wire);
}
const exact=host.requestPayload({kind:'text',text:'a'.repeat(limit)},undefined,{});assert.equal(exact.byteLength,limit);
assert.throws(()=>host.requestPayload({kind:'text',text:'a'.repeat(limit+1)},undefined,{}));
assert.throws(()=>host.requestPayload({kind:'text',text:'中'.repeat(Math.floor(limit/3)+1)},undefined,{}),'byte limit must not become a UTF-16 character count');
assert.ok(calls.every(call=>call.maxBytes===limit),'all raw/form encodes use the same production limit');
const multipart=host.buildMultipart([['name','中文']],[]);
assert.ok(Buffer.from(multipart.bytes).includes(Buffer.from('中文')),'multipart text uses the same working UTF-8 encoder');
assert.equal(destroyed,9);
console.log('PASS production request payload and HTTP POST: empty/Chinese UTF-8, GBK, form join, exact/over byte limit and multipart with broken platform TextEncoder');
console.log(nativePath?'Encoder evidence: actual SDK wrapper + C++ NAPI + Rust on Node (not VM)':'Encoder evidence: actual SDK wrapper with bounded UTF-8/GBK fixtures; native variant is independently runnable');
