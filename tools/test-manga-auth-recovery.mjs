import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/app/ReadingImageHttpError.ts',import.meta.url),'utf8')
  .replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
let xmlFields = [], parseCalls = 0, failXml = false;
const xml = {XmlPullParser: class {
  constructor(bytes,encoding){assert.ok(bytes.byteLength<=8192);assert.equal(encoding,'UTF-8');}
  parse(options){parseCalls++;assert.equal(options.supportDoctype,false);if(failXml)throw Error('bad XML');
    for(const [name,value] of xmlFields)if(!options.tagValueCallbackFunction(name,value))break;
  }
}};
const classify = new Function('xml','url',stripTypeScriptTypes(source)+';return readingImageHttpError;')(xml,{URL});
const signed='https://images.example.test/p.png?X-Amz-Signature=secret&X-Amz-Credential=credential';
const body=new TextEncoder().encode('<Error><Code>ExpiredToken</Code></Error>');
const headers={'Content-Type':'application/xml; charset=utf-8'};
xmlFields=[['Code','ExpiredToken']];
assert.equal(classify(403,headers,body,signed).message,'READING_IMAGE_SIGNATURE_EXPIRED');
assert.equal(classify(403,headers,body,'https://images.example.test/p.png').message,'READING_IMAGE_ACCESS_DENIED');
assert.equal(classify(401,headers,body,signed).message,'READING_IMAGE_AUTH_REQUIRED');
assert.equal(classify(403,{'WWW-Authenticate':'Bearer'},body,signed).message,'READING_IMAGE_AUTH_REQUIRED');
for (const fields of [[['Code','AccessDenied'],['Message','Access Denied']], [['Code','ExpiredToken'],['Code','AccessDenied']]]) {
  xmlFields=fields;assert.equal(classify(403,headers,body,signed).message,'READING_IMAGE_ACCESS_DENIED');
}
xmlFields=[['Code','AccessDenied'],['Message','Request has expired']];
assert.equal(classify(403,headers,body,signed).message,'READING_IMAGE_SIGNATURE_EXPIRED');
failXml=true;assert.equal(classify(403,headers,body,signed).message,'READING_IMAGE_ACCESS_DENIED');failXml=false;
const before=parseCalls;classify(403,headers,new Uint8Array(8193),signed);classify(403,{'content-type':'text/html'},body,signed);
assert.equal(parseCalls,before,'large errors and HTML must not be parsed as trusted service envelopes');
assert.equal(classify(429,{},body,signed).message,'READING_IMAGE_RATE_LIMITED');
const failure=classify(503,{},body,signed);assert.equal(failure.status,503);
assert.equal(failure.message,'READING_IMAGE_HTTP_FAILED');assert.ok(!JSON.stringify(failure).includes('secret'));
const Body=productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts',import.meta.url),['fetchRequestBytes'],{
  MAX_READING_IMAGE_BYTES:16777216, readingImageHttpError:classify,
  HttpExecuteHost:{instance:{async executeBytes(){return {status:401,headers:{},bytes:body};}}}
});
const host=new Body();host.assertCurrent=()=>{};
await assert.rejects(host.fetchRequestBytes({url:signed}),error=>error.message==='READING_IMAGE_AUTH_REQUIRED'&&error.status===401);

let sources=[{sourceId:'s',name:'Source',enabled:true,loginUrl:'https://source.example.test/login'}];
let opened=0, releaseLogin;const owner={async openSourceLogin(){opened++;await new Promise(r=>releaseLogin=r);}};
const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['loginMangaSource'],{
  ReaderRuntimeOwner:{current:()=>owner},SourceGateway:class{async loadSourcesForIds(ids,current){assert.deepEqual(ids,['s']);return current()?sources:[];}}
});
const index=new Index();Object.assign(index,{detailBook:{sourceId:'s',bookId:'b'},readingContentKind:'manga',readingSessionActive:true,navigationGeneration:1});
const task=index.loginMangaSource();await new Promise(r=>setImmediate(r));assert.equal(opened,1);
await assert.rejects(index.loginMangaSource(),/IN_PROGRESS/);releaseLogin();await task;assert.equal(index.mangaLoginTask,undefined);
const stale=index.loginMangaSource();await new Promise(r=>setImmediate(r));index.navigationGeneration++;releaseLogin();await assert.rejects(stale,/CANCELLED/);
sources=[];await assert.rejects(index.loginMangaSource(),/LOGIN_UNAVAILABLE/);assert.equal(opened,2);
index.readingContentKind='text';await assert.rejects(index.loginMangaSource(),/CANCELLED/);
console.log('PASS production image HTTP classification and explicit reader login: bounded platform parser boundary, no guessed 403 refresh, single owner, absent login, stale navigation and no text route');
