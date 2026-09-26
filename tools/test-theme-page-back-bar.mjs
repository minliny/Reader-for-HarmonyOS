import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8');
const {owner}=createReaderBuilderProbe(source,['trailing','build'],{TYPE_PAGE_TITLE:{fontFamily:'title',fontWeight:400,fontSizeFp:24,lineHeightFp:30}});
// Initialize the actual regular field expression from the production declaration;
// the original implementation captures Day here and then never recalculates it.
const initial=source.match(/titleColor:\s*string\s*=\s*([^;]+);/)[1];
Object.assign(owner,{appThemeScheme:'day',title:'通用设置',leftInset:()=>20,rightInset:()=>20});
owner.titleColor=new Function('readerAppColor',`return ${initial}`).call(owner,readerAppColor);
owner.initialRender();
const title=()=>[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='通用设置');
for(const scheme of ['day','night','day']){
 owner.appThemeScheme=scheme;owner.replay();
 assert.equal(title().fontColor,readerAppColor('TOK_INK',scheme),'retained default title follows live App theme');
}
assert.match(source,/@Prop\s+titleColor:\s*string/,'explicit parent override must be a reactive child Prop');
for(const scheme of ['day','night','day']){
 owner.appThemeScheme=scheme;
 owner.titleColor=readerAppColor('app.SyncPage.backBar.paint.FF1A1612',scheme);owner.replay();
 assert.equal(title().fontColor,owner.titleColor,'Sync authored override follows parent updates');
}
owner.titleColor='';owner.appThemeScheme='night';owner.replay();
assert.equal(title().fontColor,readerAppColor('TOK_INK','night'),'removing override restores live default');
console.log('PASS retained shared PageBackBar Day/Night/Day and reactive Sync override; no palette changes or pixel claim');
