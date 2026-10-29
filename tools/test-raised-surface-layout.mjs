import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
  'geometry-underlap':{description:'Actual page resolver keeps text/notice clearance and footer avoidance while shelf/detail paint enters overlay chrome; invalid or inline inputs retain safe behavior.'},
});
if(selected.length){
  registerHooks({resolve(specifier,context,next){
    if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){
      const url=new URL(specifier+'.ts',context.parentURL);
      if(existsSync(fileURLToPath(url)))return next(url.href,context);
    }
    return next(specifier,context);
  }});
  const {ReaderPageGeometryInput,resolveReaderPageGeometry}=await import('../entry/src/main/ets/features/common/ReaderPageGeometry.ts');
  const input=new ReaderPageGeometryInput();
  input.viewportWidth=366;input.viewportHeight=800;
  input.headerTop=40;input.headerHeight=53;input.contentGap=14;
  input.contentHorizontalPadding=20;input.footerSurface='solid';
  input.footerHeight=68;input.footerBottom=15;
  const baseline=resolveReaderPageGeometry(input);
  assert.equal(baseline.header.bottom,93);assert.equal(baseline.header.clearance,107);
  assert.equal(baseline.content.startInset,107);
  input.contentUnderlap=8;
  const raised=resolveReaderPageGeometry(input);
  assert.equal(raised.content.startInset,85,'paint enters header by 8vp');
  assert.deepEqual(raised.header,baseline.header,'text/notice safety line does not move');
  assert.deepEqual(raised.footer,baseline.footer,'dock geometry does not move');
  assert.deepEqual(raised.content.frame,baseline.content.frame,'horizontal layout does not move');
  assert.equal(raised.content.endInset,83);assert.equal(raised.content.nativeEndInset,83);
  // A taller measured header preserves the same logical underlap without
  // taking space away from scaled text below its independent safety line.
  input.headerHeight=71;
  const large=resolveReaderPageGeometry(input);
  assert.equal(large.content.startInset,103);assert.equal(large.header.clearance,125);
  for(const underlap of [0,-8,NaN,Infinity]){
    input.contentUnderlap=underlap;
    assert.equal(resolveReaderPageGeometry(input).content.startInset,125,'invalid underlap preserves full avoidance');
  }
  input.contentUnderlap=200;
  assert.equal(resolveReaderPageGeometry(input).content.startInset,0,'paint never starts above the viewport');
  input.chromeMode='inline';
  const inline=resolveReaderPageGeometry(input);
  assert.equal(inline.content.startInset,0);assert.equal(inline.content.endInset,0);assert.equal(inline.content.nativeEndInset,0);
  recordContractCasePass('geometry-underlap');
}
