import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"field": {"description": "实际SearchField实时字体缩放、vp frame增长与IME/无效scale回落", "resources": []}, "action": {"description": "实际有限search action随scale增高、原生事件与卸载拒绝", "resources": []}, "header": {"description": "实际SearchPage状态/宽度/字体变化使测量key失效并接纳当前测量", "resources": []}, "card": {"description": "保留实际result card的标签frame随字体增长及长文本约束", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');
const {createHash} = await import('node:crypto');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { tailControls, compileTailConsumer } = await import('./lib/foundation-tail-consumer-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { bookIntroText } = await import('../entry/src/main/ets/features/common/BookIntroText.ts');
const { bookAuthorLabel } = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');

const read=path=>readFileSync(new URL('../entry/src/main/ets/features/'+path,import.meta.url),'utf8');
const pageSource=read('search/SearchPage.ets'), fieldSource=read('common/ReaderSearchField.ets'),buttonSource=read('common/ReaderButton.ets');
let scale=1;
const windowMetrics=()=>({systemFontScale:scale});
const shared=foundationControls({windowMetrics,buttonSource});
const controls=tailControls({foundation:shared});
const dependencies={...controls.dependencies,ReaderWindowCoordinator:{metrics:windowMetrics}};
let count=0;
// Run the actual native input Builder and its production field/input geometry.
// fp tuples remain base units: ArkUI scales glyphs, while vp boxes grow once.
if(selectedCase==='field'){
const field=compileTailConsumer(fieldSource,boundedMembers(fieldSource),dependencies,shared.hooks).owner;
Object.assign(field,{variant:'bookPage',mode:'submit',text:'大明望族',placeholder:'搜索书名、作者...',clearable:true,
 readerWindowMetricsRevision:0,isTablet:false,appThemeScheme:'day',onTextChange:v=>{field.text=v;},onSubmit:()=>count++});
field.initialRender();
for(const tablet of [false,true])for(const fontScale of [2,1,1.3,1.75,3.2]){
 scale=fontScale;field.isTablet=tablet;field.readerWindowMetricsRevision++;
 field.replay();
 const height=field.fieldHeight();assert.ok(Number.isFinite(height)&&height>0);if(fontScale>1){scale=1;const base=field.fieldHeight();scale=fontScale;assert.ok(height>base,'large native glyphs require a larger vp box');}
 assert.equal(field.fieldHeight(),height,'book input vp frame must grow with the native fp line');
 const row=[...field.nodes.values()].find(n=>n.type==='Row'),input=[...field.nodes.values()].find(n=>n.type==='TextInput');
 assert.equal(row.height,height);assert.equal(input.height,height);assert.equal(input.fontSize,readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.fontSizeFp);assert.equal(input.lineHeight,readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.lineHeightFp);
 assert.equal(input.minFontScale,1);assert.equal(input.maxFontScale,fontScale);
 
 input.onSubmit('Enter');
}
assert.equal(count,10,'IME submit survives each scale/device change');for(const invalid of [NaN,Infinity,0,-1]){scale=invalid;assert.equal(field.bookFontScale(),1);}
}
// The finite search Button family shares the existing native action and
// half-leading alignment. Other common Button variants retain their tuples.
if(selectedCase==='action')for(const tablet of [false,true])for(const fontScale of [1,1.3,1.75,2,3.2])for(const busy of [false,true]){
 scale=fontScale;const component=shared.button.Component;
 const button=new component(undefined,{scheme:'day',specId:tablet?'search-field-wide':'search-field-phone',label:busy?'停止':'搜索',
  actionEnabled:true,isBusy:busy,leading(){},onAction:()=>count++},undefined,100+count);
 button.aboutToAppear();button.initialRender();
 const native=shared.nodes(button).find(n=>n.onClick),label=shared.nodes(button).find(n=>n.type==='Text');
 const measured=native.height;assert.ok(Number.isFinite(measured)&&measured>0);if(fontScale>1){scale=1;button.replay();const base=shared.nodes(button).find(n=>n.onClick).height;scale=fontScale;button.replay();assert.ok(measured>base,'large font action frame grows');}
 assert.ok(label.lineHeight>0);assert.equal(label.maxFontScale,fontScale);assert.equal(label.halfLeading,true);
 assert.equal(native.enabled,true);native.onClick();assert.ok(count>0);button.aboutToDisappear();const before=count;native.onClick();assert.equal(count,before);
}
// Actual production page methods + Builders are extracted, rather than a
// reconstructed layout formula. Public PageScaffold owns header measurement.
if(selectedCase==='header'){
const methods=['searchHeader','searchHeaderHeight','searchHeaderLayoutKey','searchContentStartInset','searchBar','searchActionLeading',
 'groupScopeRow','groupScopeChip','contentTypeRow','contentTypeChip','scopeEntries','scopeSourceIds','groupNames','operation','isSweeping','canSubmit'];
const p=compileTailConsumer(pageSource,methods,{...dependencies,SEARCH_LOCAL_SCOPE:'本地',SEARCH_ONLINE_SCOPE:'在线'},controls.hooks).owner;
Object.assign(p,{appThemeScheme:'day',readerWindowMetricsRevision:0,searchSources:[{sourceId:'online',enabled:true,group:'七猫'}],
 selectedGroupName:'全部',selectedContentType:'全部类型',keyword:'大明望族',viewState:new SearchViewState(),focusInputOnAppear:false,
 reduceMotion:false,spinnerRunKey:1,contentFrame:()=>({width:320,left:0,right:0}),resultStats(){},onBack(){},onStop:()=>count++,onSearch:()=>count++});
let priorKey;
for(const width of [320,390,736])for(const fontScale of [1,1.3,1.75,2,3.2])for(const kind of ['initial','loading','results','empty']){
 scale=fontScale;p.isTablet=width===736;p.readerWindowMetricsRevision++;p.contentFrame=()=>({width,left:0,right:0});
 p.presentation={kind,results:[],history:[],searching:kind==='results',operation:{canCancel:kind==='loading'||kind==='results'}};
 p.searchHeader();controls.flush(p);
 const groups=kind==='results'||kind==='empty';const expected=p.searchBarHeight()+(groups?p.searchFilterHeight()*2:0);
 assert.equal(p.searchHeaderHeight(),expected);
 assert.ok(Number.isFinite(p.searchBarHeight())&&p.searchBarHeight()>0);assert.ok(Number.isFinite(p.searchFilterHeight())&&p.searchFilterHeight()>0);if(fontScale>1){scale=1;const unscaled=p.searchFilterHeight();scale=fontScale;assert.ok(p.searchFilterHeight()>unscaled);}
 assert.ok(p.searchFilterLabelWidth()>0);assert.deepEqual(p.groupNames(),['本地','在线']);
 p.fixedHeaderHeight=17;p.fixedHeaderLayoutKey='prior-font';p.resultStatsHeight=28.5;
 assert.ok(p.searchContentStartInset()>=expected,'old measured frame cannot cover new scaled header');
 const key=p.searchHeaderLayoutKey();assert.notEqual(key,priorKey);priorKey=key;
 p.fixedHeaderHeight=expected+91;p.fixedHeaderLayoutKey=key;assert.equal(p.searchContentStartInset(),expected+91,'public measured header becomes authoritative');
 const rows=controls.nodes(p).filter(n=>n.type==='Row');
 assert.ok(rows.some(n=>n.constraintSize?.minHeight===p.searchBarHeight()),'bar grows with live children');
 if(groups){assert.ok(controls.nodes(p).some(n=>n.create==='内容类型'&&n.width===p.searchFilterLabelWidth()));}
 const action=[...p.children.values()].find(c=>c.specId?.startsWith('search-field-'));
 assert.ok(action);assert.equal(action.label,kind==='loading'||kind==='results'?'停止':'搜索');

}
for(const invalid of [NaN,Infinity,0,-1]){scale=invalid;assert.equal(p.searchFontScale(),1);}
}
if(selectedCase==='card'){
// Retained result cards keep the approved compact manga tuple while their vp
// badge frames track glyph growth; long metadata remains bounded and ellipsized.
const cardSource=pageSource.slice(pageSource.lastIndexOf('@Component',pageSource.indexOf('struct SearchResultCard')));
const card=compileTailConsumer(cardSource,['build','displayIntro','coverWidth','coverHeight','coverErrorHandler','searchFontScale','resultTagWidth','resultTagHeight'],{...dependencies,bookIntroText,bookAuthorLabel,ImageFit:{Cover:'Cover'}},controls.hooks).owner;
const book={sourceId:'online',bookId:'b',sourceName:'非常长的实际书源名称'.repeat(8),title:'书籍',author:'作者',category:'comic'};
Object.assign(card,{group:{book,coverUrl:'',variants:[book],sourceCount:10000,inBookshelf:true},appThemeScheme:'day',readerWindowMetricsRevision:0,isTablet:false,cardWidth:320});
card.initialRender();
for(const fontScale of [1,1.75,2,3.2]){scale=fontScale;card.readerWindowMetricsRevision++;card.replay();
 const nodes=controls.nodes(card),badges=nodes.filter(n=>n.type==='Text'&&['漫画','在线'].includes(n.create));
 assert.equal(badges.length,2);for(const badge of badges){assert.equal(badge.width,card.resultTagWidth());assert.equal(badge.height,card.resultTagHeight());if(fontScale>1){scale=1;const base=card.resultTagHeight();scale=fontScale;assert.ok(badge.height>base);}}
 for(const tag of nodes.filter(n=>n.type==='Text'&&n.constraintSize?.maxWidth==='100%')){assert.equal(tag.constraintSize.maxWidth,'100%');assert.equal(tag.textOverflow.overflow,'TextOverflow.Ellipsis');}
 assert.equal(nodes.find(n=>n.type==='Column'&&n.layoutWeight===1).height,undefined,'large text does not force a fixed cover-height information column');
}


}

}
