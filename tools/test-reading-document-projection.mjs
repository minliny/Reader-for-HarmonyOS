import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
const load=()=>import('../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts');
async function blockContract(){const {materializeReadingDocument}=await load();
const loads = [];
const runtime = {
  async request() {
    throw new Error('Core request is not used by the projection test');
  },
  async loadReadingImage(sourceId, imageUrl, baseUrl) {
    loads.push({ sourceId, imageUrl, baseUrl });
    return {
      pixelMap: { fixture: 'pixel-map' },
      width: 320,
      height: 180,
      revision: 'image-r1',
    };
  },
};

const textOnly = await materializeReadingDocument(
  { content: 'A😀B' },
  'source-a',
  'https://books.example.test/chapter/1.html',
  runtime,
);
assert.equal(textOnly.content, 'A😀B');
assert.deepEqual(textOnly.images, []);
assert.equal(loads.length, 0, 'text-only chapters must not touch the image Host');

const longUnicodeText = 'A😀'.repeat(2048);
const longUnicode = await materializeReadingDocument(
  {
    content: longUnicodeText,
    blocks: [{ kind: 'text', text: longUnicodeText, startScalar: 0, endScalar: 4096 }],
  },
  'source-a',
  undefined,
  runtime,
);
assert.equal(longUnicode.content, longUnicodeText);

const content = 'A😀\n\n\uFFFC\n\nB';
const projected = await materializeReadingDocument(
  {
    content,
    blocks: [
      { kind: 'text', text: 'A😀\n\n', startScalar: 0, endScalar: 4 },
      { kind: 'image', source: '../media/a.png', startScalar: 4, endScalar: 5 },
      { kind: 'text', text: '\n\nB', startScalar: 5, endScalar: 8 },
    ],
  },
  'source-a',
  'https://books.example.test/chapter/1.html',
  runtime,
);
assert.equal(projected.content, content);
assert.deepEqual(projected.images, [{
  source: '../media/a.png',
  baseUrl: 'https://books.example.test/chapter/1.html',
  startScalar: 4,
  endScalar: 5,
  state: 'pending',
  pixelMap: undefined,
  fileUri: '',
  intrinsicWidth: 0,
  intrinsicHeight: 0,
  imageWidthBasisPoints: undefined,
  revision: 'pending',
}]);
assert.deepEqual(loads, [], 'chapter materialization must not eagerly fetch body images');
assert.match(projected.contentVersion, /^reader-document-v1:/,
  'image anchors and sources must participate in pagination identity');

const canonicalBase = await materializeReadingDocument(
  {
    content: '\uFFFC',
    blocks: [{ kind: 'image', source: 'same.png', startScalar: 0, endScalar: 1 }],
  },
  'source-a',
  ' https://books.example.test/chapter/1.html#reader-position ',
  runtime,
);
assert.equal(canonicalBase.images[0].baseUrl, 'https://books.example.test/chapter/1.html',
  'live and cached image identities must ignore non-request URL fragments');

const duplicate = await materializeReadingDocument(
  {
    content: '\uFFFC\n\n\uFFFC',
    blocks: [
      { kind: 'image', source: 'same.png', startScalar: 0, endScalar: 1 },
      { kind: 'text', text: '\n\n', startScalar: 1, endScalar: 3 },
      { kind: 'image', source: 'same.png', startScalar: 3, endScalar: 4 },
    ],
  },
  'source-a',
  'https://books.example.test/chapter/2.html',
  runtime,
);
assert.equal(duplicate.images.length, 2);
assert.equal(loads.length, 0, 'even repeated sources stay pending until pagination reaches them');

await assert.rejects(
  materializeReadingDocument(
    {
      content: '\uFFFC',
      blocks: [{ kind: 'image', source: 'bad.png', startScalar: 1, endScalar: 2 }],
    },
    'source-a',
    undefined,
    runtime,
  ),
  /contiguous canonical scalar projection/,
  'Core block gaps must fail closed before Host image loading',
);

await assert.rejects(
  materializeReadingDocument(
    {
      content: '\uFFFC',
      blocks: undefined,
    },
    'source-a',
    undefined,
    runtime,
  ),
  /missing Core block metadata/,
  'a canonical image scalar without Core metadata must still fail closed',
);


}
async function cooperative() {
 const {materializeReadingDocument}=await load();
 const originalTimer=globalThis.setTimeout,originalPoint=String.prototype.codePointAt;
 const gates=[];let visits=0;
 globalThis.setTimeout=(callback,delay)=>{assert.equal(delay,0);gates.push(callback);return gates.length;};
 String.prototype.codePointAt=function(index){visits++;return originalPoint.call(this,index);};
 const runtime={request(){throw Error('unexpected Core IO');},loadReadingImage(){throw Error('unexpected image IO');}};
 async function drain(task) {
  let settled=false,error,value;task.then(v=>{settled=true;value=v;},e=>{settled=true;error=e;});
  for(let step=0;step<16&&!settled;step++){await new Promise(resolve=>setImmediate(resolve));const next=gates.shift();if(next)next();}
  assert.equal(settled,true,'projection settles with a bounded number of explicit yield admissions');if(error)throw error;return value;
 }
 try {
  for(const split of [false,true]) {
   const content='甲😀'.repeat(24000),scalars=48000;
   const blocks=split?Array.from({length:24000},(_,i)=>({kind:'text',text:'甲😀',startScalar:i*2,endScalar:i*2+2})):[{kind:'text',text:content,startScalar:0,endScalar:scalars}];
   visits=0;const task=materializeReadingDocument({content,blocks},'local',undefined,runtime,()=>true,0,'v');
   await new Promise(resolve=>setImmediate(resolve));assert.equal(gates.length,1,'actual production projection yielded before completion');
   const result=await drain(task);assert.equal(result.content,content);assert.equal(visits,scalars,'canonical scalar validation visits each scalar once rather than rescanning per block');assert.equal(gates.length,0);
   let current=true;const cancelled=materializeReadingDocument({content,blocks},'local',undefined,runtime,()=>current,0,'v');
   await new Promise(resolve=>setImmediate(resolve));assert.equal(gates.length,1);current=false;
   await assert.rejects(drain(cancelled),/cancelled/);assert.equal(gates.length,0);
  }
  await assert.rejects(materializeReadingDocument({content:'body'},'local',undefined,runtime,()=>false),/cancelled/);
 } finally {globalThis.setTimeout=originalTimer;String.prototype.codePointAt=originalPoint;}
}
const cases={'block-contract':blockContract,cooperative};
for(const id of selectContractCases({'block-contract':'Actual canonical text/image block projection without eager IO',cooperative:'Actual one-pass scalar work, explicit yields and cancellation for giant/many blocks'})){await cases[id]();recordContractCasePass(id);}
