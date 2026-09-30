import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {ReaderPageChromeSnapshot} from '../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts';
const stage=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets',import.meta.url),'utf8');
const classText=stage.slice(stage.indexOf('export class ReaderPageTurnRenderPage'),stage.indexOf('\nexport type ReaderPageTurnStageDirection'));
const RenderPage=new Function('ReaderPageChromeSnapshot',stripTypeScriptTypes(classText).replace('export class','class')+';return ReaderPageTurnRenderPage;')(ReaderPageChromeSnapshot);
const Owner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['preparedPageTurnRenderPage','isChapterFirstPageStart'],{ReaderPageTurnRenderPage:RenderPage});
for(const start of [0,600]) for(const direction of ['next','previous']) {
 const chapter={chapterTitle:'Next chapter',documentRange:{startScalar:start}};
 const ranges=[{startScalar:start}]; const fragments=[{text:'body',nativeTitle:{text:chapter.chapterTitle}}];
 const prepared={context:{chapter,paragraphRanges:ranges,layoutMap:{scalarCount:()=>1200}},page:{startScalar:start,fragments},key:{chapterIndex:42}};
 const owner=Object.assign(new Owner(),{pageTurnFrozenRevision:-1,pageTurnRenderRevision:3,preparedNextPage:prepared,preparedPreviousPage:prepared,chapter,paragraphRanges:ranges,isPreparedPageTurnFresh:()=>true,pageBottomJustifyGap:()=>0,pageChromeSnapshot:()=>new ReaderPageChromeSnapshot(),bookTurnTextureIdentity:()=>'',bookTurnSurfaceIdentity:()=>'',pageReadingAppearance:()=>undefined});
 const rendered=owner.preparedPageTurnRenderPage(direction);
 assert.equal(rendered.showChapterTitle,start===0,'resident window start is not semantic chapter start');
 assert.equal(rendered.showChapterTitle,owner.isChapterFirstPageStart(start),'prepared and promoted title admission agree');
 assert.equal(rendered.fragments,fragments);assert.equal(rendered.chapterTitle,chapter.chapterTitle);
 chapter.documentRange=undefined;
 assert.equal(owner.preparedPageTurnRenderPage(direction).showChapterTitle,true,'legacy full chapter retains existing first-range contract');
}
console.log('PASS actual prepared next/previous title admission matches promoted full chapter versus bounded window');
