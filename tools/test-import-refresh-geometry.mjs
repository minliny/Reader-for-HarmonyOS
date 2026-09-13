import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets',root),'utf8');
const {owner}=createReaderBuilderProbe(source,['resultSummary']);
Object.assign(owner,{appThemeScheme:'day',summaryIcon:()=> 'app.media.import_success',allSucceeded:()=>true,
  summaryTitle:()=> '导入完成',resultCountText:()=> '1本已在书架'});
owner.resultSummary();const records=[];
const original=readFileSync(new URL('docs/ui-design/svg-provenance/figma-page-assets/import_refresh.svg',root),'utf8');
const media=new URL('entry/src/main/resources/base/media/',root);
const day=readFileSync(new URL('import_refresh.svg',media),'utf8');
const night=readFileSync(new URL('import_refresh_theme_night.svg',media),'utf8');
const paths=s=>s.match(/<path[^>]+>/g);
assert.equal(paths(original).length,1,'live Figma 2657:819/820 contains one C arc, not a missing arrow');
assert.deepEqual(paths(day),paths(original),'authored arc path, stroke, round caps are unchanged');
assert.equal(night.replaceAll('#D2BD96','#2D4A3E'),day,'Night derives only the existing palette');
assert.doesNotMatch(day,/<clipPath/,'rotated export clip is removed by established platform adapter');
const stroke=Number(day.match(/stroke-width="([\d.]+)"/)[1]);
for(const scheme of ['day','night','day']){
  owner.appThemeScheme=scheme;owner.replay();
  const n=[...owner.nodes.values()].find(n=>n.type==='Image'&&n.create.includes('import_refresh'));
  const sx=n.scale?.x??1,sy=n.scale?.y??1;
  assert.deepEqual([n.width,n.height],[18,18],'layout allocation remains authored 18vp');
  assert.ok(Math.abs(n.width*sx-23.754)<0.001&&Math.abs(n.height*sy-23.754)<0.001,
    'rotated SVG paint restores Figma bound, avoiding second 18/24 downscale');
  assert.ok(Math.abs(stroke*n.width*sx/24-1.5)<0.001,'actual authored 1.5vp stroke restored');
  assert.equal(n.create,`app.media.import_refresh${scheme==='night'?'_theme_night':''}`);
  assert.equal(n.rotate,undefined,'rotation is baked into SVG and must not be applied again');
  records.push({scheme,resource:n.create,layout:[n.width,n.height],scale:[sx,sy],paint:[n.width*sx,n.height*sy],stroke:stroke*n.width*sx/24});
}
const i=process.argv.indexOf('--record');if(i>=0)writeFileSync(process.argv[i+1],JSON.stringify({sourceNodes:['2657:818','2657:819','2657:820'],layer:'actual SDK Builder retained paint calls; new device pixels OPEN',records},null,2)+'\n');
console.log('PASS import refresh: Figma C arc/source unchanged, 18vp slot, 23.754vp paint, 1.5vp stroke; retained Day/Night/Day.');
