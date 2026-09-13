import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createReaderBuilderProbe} from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-control-builder-probe.mjs';
const file='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/LocalImportDialog.ets';
const src=readFileSync(file,'utf8');
const {owner}=createReaderBuilderProbe(src,['resultSummary']);
Object.assign(owner,{appThemeScheme:'day',summaryIcon:()=> 'app.media.import_success',allSucceeded:()=>true,summaryTitle:()=> '导入完成',resultCountText:()=> '1本已在书架'});
owner.resultSummary();const records=[];
for(const scheme of ['day','night','day']){owner.appThemeScheme=scheme;owner.replay();const n=[...owner.nodes.values()].find(n=>n.type==='Image'&&n.create.includes('import_refresh'));records.push({scheme,resource:n.create,width:n.width,height:n.height,expectedPaint:23.754,stroke:1.51556*n.width/24});}
writeFileSync('/private/tmp/reader-import-refresh-builder-'+(records[0].width===18?'before':'after')+'.json',JSON.stringify({records,nodes:[...owner.nodes.values()]},null,2)+'\n');
assert.ok(records.every(r=>Math.abs(r.width-23.754)<0.001&&Math.abs(r.height-23.754)<0.001),'rotated export paint occupies its authored 23.754 bound inside 18 layout slot, not a second 18/24 downscale');
console.log('PASS actual SDK import refresh paint geometry and Day/Night/Day retained resource updates');
