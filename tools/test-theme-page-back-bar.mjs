import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryHeaderHeight } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8');
const {owner}=createReaderBuilderProbe(source,['trailing','build'],{TYPE_PAGE_TITLE:{fontFamily:'title',fontWeight:400,fontSizeFp:24,lineHeightFp:30}});
// Initialize the actual regular field expression from the production declaration;
// the original implementation captures Day here and then never recalculates it.
const initial=source.match(/titleColor:\s*string\s*=\s*([^;]+);/)[1];
Object.assign(owner,{appThemeScheme:'day',title:'通用设置',leftInset:()=>20,rightInset:()=>20});
owner.titleColor=new Function('readerAppColor',`return ${initial}`).call(owner,readerAppColor);
owner.initialRender();
const title=()=>[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='通用设置');
assert.deepEqual(owner.attributeCalls.find(call=>call.id===title().id&&call.property==='fontWeight').args,
 [400,{enableVariableFontWeight:false}],'standard header preserves its original numeric admission policy');
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
let fontScale=1;
const manga=createReaderBuilderProbe(source,['trailing','build','mangaFontScale','leftInset','rightInset'],{
 ...fonts,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:fontScale})},
}).owner;
Object.assign(manga,{variant:'mangaDirectory',floating:true,centered:true,title:'章节目录',titleColor:'',appThemeScheme:'day',readerWindowMetricsRevision:0});
manga.initialRender();
for(const scheme of ['day','night','day']){
 manga.appThemeScheme=scheme;manga.replay();
 const text=[...manga.nodes.values()].find(node=>node.type==='Text'&&node.create==='章节目录');
 assert.equal(text.fontColor,mangaDirectoryColor('ink',scheme));
 assert.equal(text.fontFamily,fonts.READER_FONT_NOTO_SANS_SC_UI_650);
 assert.deepEqual(manga.attributeCalls.filter(call=>call.id===text.id&&call.property==='fontWeight').at(-1).args,
  [visual.headerFontWeight,{enableVariableFontWeight:true}],
  'numeric650 is admitted explicitly by the SDK while the selected physical face remains static650');
 assert.equal(text.fontSize,visual.headerFontSize);assert.equal(text.lineHeight,visual.headerLineHeight);
}
fontScale=3.2;manga.replay();
const frame=[...manga.nodes.values()].find(node=>node.type==='Row'&&node.height===mangaDirectoryHeaderHeight(fontScale));
assert.ok(frame,'finite manga variant grows its frame with the production shared scale function');
assert.deepEqual(frame.padding,{left:visual.headerPadding,right:visual.headerPadding});
function checkNumericAdmission(candidate){
 const probe=createReaderBuilderProbe(candidate,['trailing','build','mangaFontScale','leftInset','rightInset'],{
  ...fonts,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1})},
 }).owner;
 Object.assign(probe,{variant:'mangaDirectory',floating:true,centered:true,title:'章节目录',titleColor:'',appThemeScheme:'day',readerWindowMetricsRevision:0});
 probe.initialRender();
 const text=[...probe.nodes.values()].find(node=>node.type==='Text'&&node.create==='章节目录');
 assert.equal(text.fontFamily,fonts.READER_FONT_NOTO_SANS_SC_UI_650);
 assert.deepEqual(probe.attributeCalls.find(call=>call.id===text.id&&call.property==='fontWeight').args,
  [visual.headerFontWeight,{enableVariableFontWeight:true}]);
}
const missingNumericAdmission=source.replace("enableVariableFontWeight: this.variant === 'mangaDirectory'",'enableVariableFontWeight: false');
assert.notEqual(missingNumericAdmission,source);
assert.throws(()=>checkNumericAdmission(missingNumericAdmission),assert.AssertionError,
 'SDK default100-step numeric weight constraints cannot silently reject650');
console.log('PASS retained shared PageBackBar Day/Night/Day and reactive Sync override; no palette changes or pixel claim');
