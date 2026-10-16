import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {createHash} from 'node:crypto';
import {sharedProducerShape,registeredProducerTypographySlots} from './lib/architecture-shared-producer-contract.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { tailControls, compileTailConsumer } from './lib/foundation-tail-consumer-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { SearchViewState } from '../entry/src/main/ets/features/search/SearchViewState.ts';
const read = path => readFileSync(process.env.READER_SEARCH_SCALE_SOURCE_ROOT ?
  resolve(process.env.READER_SEARCH_SCALE_SOURCE_ROOT, path.split('/').at(-1)) :
  new URL('../entry/src/main/ets/features/' + path, import.meta.url), 'utf8');
const pageSource=read('search/SearchPage.ets'), fieldSource=read('common/ReaderSearchField.ets'),buttonSource=read('common/ReaderButton.ets');
let scale=1;
const windowMetrics=()=>({systemFontScale:scale});
const shared=foundationControls({windowMetrics,buttonSource});
const controls=tailControls({foundation:shared});
const dependencies={...controls.dependencies,ReaderWindowCoordinator:{metrics:windowMetrics}};
let count=0;
// Run the actual native input Builder and its production field/input geometry.
// fp tuples remain base units: ArkUI scales glyphs, while vp boxes grow once.
const field=compileTailConsumer(fieldSource,boundedMembers(fieldSource),dependencies,shared.hooks).owner;
Object.assign(field,{variant:'bookPage',mode:'submit',text:'大明望族',placeholder:'搜索书名、作者...',clearable:true,
 readerWindowMetricsRevision:0,isTablet:false,appThemeScheme:'day',onTextChange:v=>{field.text=v;},onSubmit:()=>count++});
field.initialRender();
for(const tablet of [false,true])for(const fontScale of [2,1,1.3,1.75,3.2]){
 scale=fontScale;field.isTablet=tablet;field.readerWindowMetricsRevision++;
 field.replay();
 const height=(tablet?40:36)+readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.lineHeightFp*Math.max(0,scale-1);
 assert.equal(field.fieldHeight(),height,'book input vp frame must grow with the native fp line');
 const row=[...field.nodes.values()].find(n=>n.type==='Row'),input=[...field.nodes.values()].find(n=>n.type==='TextInput');
 assert.equal(row.height,height);assert.equal(input.height,height);assert.equal(input.fontSize,14);assert.equal(input.lineHeight,21);
 assert.equal(input.minFontScale,1);assert.equal(input.maxFontScale,fontScale);assert.equal(input.borderRadius,0);
 assert.equal(input.padding,0);assert.equal(row.borderRadius,999);
 input.onSubmit('Enter');
}
assert.equal(count,10,'IME submit survives each font-scale and device-class change');
// The finite search Button family shares the existing native action and
// half-leading alignment. Other common Button variants retain their tuples.
for(const tablet of [false,true])for(const fontScale of [1,1.3,1.75,2,3.2])for(const busy of [false,true]){
 scale=fontScale;const component=shared.button.Component;
 const button=new component(undefined,{scheme:'day',specId:tablet?'search-field-wide':'search-field-phone',label:busy?'停止':'搜索',
  actionEnabled:true,isBusy:busy,leading(){},onAction:()=>count++},undefined,100+count);
 button.aboutToAppear();button.initialRender();
 const native=shared.nodes(button).find(n=>n.onClick),label=shared.nodes(button).find(n=>n.type==='Text');
 const line=tablet?22:20,expected=(tablet?40:36)+line*(fontScale-1);
 assert.equal(native.height,expected);assert.equal(label.lineHeight,line);assert.equal(label.maxFontScale,fontScale);assert.equal(label.halfLeading,true);
 assert.equal(native.enabled,true);native.onClick();assert.ok(count>10);button.aboutToDisappear();const before=count;native.onClick();assert.equal(count,before);
}
scale=2;
const unrelated=new shared.button.Component(undefined,{scheme:'day',specId:'rules-action',label:'执行',actionEnabled:true},undefined,888);
unrelated.aboutToAppear();unrelated.initialRender();assert.equal(shared.nodes(unrelated).find(n=>n.onClick).height,40);
// Actual production page methods + Builders are extracted, rather than a
// reconstructed layout formula. Public PageScaffold owns header measurement.
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
 assert.ok(p.searchBarHeight()>=(p.isTablet?56:52));assert.ok(p.searchFilterHeight()>=23*fontScale+18||fontScale===1);
 assert.equal(p.searchFilterLabelWidth(),51*fontScale);assert.deepEqual(p.groupNames(),['本地','在线']);
 p.fixedHeaderHeight=17;p.fixedHeaderLayoutKey='prior-font';p.resultStatsHeight=28.5;
 assert.ok(p.searchContentStartInset()>=expected,'old measured frame cannot cover new scaled header');
 const key=p.searchHeaderLayoutKey();assert.notEqual(key,priorKey);priorKey=key;
 p.fixedHeaderHeight=expected+91;p.fixedHeaderLayoutKey=key;assert.equal(p.searchContentStartInset(),expected+91,'public measured header becomes authoritative');
 const rows=controls.nodes(p).filter(n=>n.type==='Row');
 assert.ok(rows.some(n=>n.constraintSize?.minHeight===p.searchBarHeight()),'bar grows with live children');
 if(groups){assert.ok(controls.nodes(p).some(n=>n.create==='内容类型'&&n.width===51*fontScale));}
 const action=[...p.children.values()].find(c=>c.specId?.startsWith('search-field-'));
 assert.ok(action);assert.equal(action.label,kind==='loading'||kind==='results'?'停止':'搜索');
 const spinner=controls.nodes(p).filter(n=>n.type==='LoadingProgress');
 assert.ok(spinner.every(n=>n.width===28&&n.height===28),'calibrated stop spinner is not shrunk or font-scaled');
}
// Retained result cards keep the approved compact manga tuple while their vp
// badge frames track glyph growth; long metadata remains bounded and ellipsized.
const cardSource=pageSource.slice(pageSource.lastIndexOf('@Component',pageSource.indexOf('struct SearchResultCard')));
const card=compileTailConsumer(cardSource,['build','displayIntro','coverWidth','coverHeight','coverErrorHandler','searchFontScale','resultTagWidth','resultTagHeight'],{...dependencies,bookIntroText,bookAuthorLabel,ImageFit:{Cover:'Cover'}},controls.hooks).owner;
const book={sourceId:'online',bookId:'b',sourceName:'非常长的实际书源名称'.repeat(8),title:'书籍',author:'作者',category:'comic'};
Object.assign(card,{group:{book,coverUrl:'',variants:[book],sourceCount:10000,inBookshelf:true},appThemeScheme:'day',readerWindowMetricsRevision:0,isTablet:false,cardWidth:320});
card.initialRender();
for(const fontScale of [1,1.75,2,3.2]){scale=fontScale;card.readerWindowMetricsRevision++;card.replay();
 const nodes=controls.nodes(card),badges=nodes.filter(n=>n.type==='Text'&&n.borderRadius===5);
 assert.equal(badges.length,2);for(const badge of badges){assert.equal(badge.width,30*scale);assert.equal(badge.height,16+14*(scale-1));assert.equal(badge.fontSize,9);assert.equal(badge.lineHeight,14);}
 for(const tag of nodes.filter(n=>n.type==='Text'&&n.borderRadius===4)){assert.equal(tag.constraintSize.maxWidth,'100%');assert.equal(tag.textOverflow.overflow,'TextOverflow.Ellipsis');}
 assert.equal(nodes.find(n=>n.type==='Column'&&n.layoutWeight===1).height,undefined,'large text does not force a fixed cover-height information column');
}
for(const invalid of [NaN,Infinity,0,-1]){scale=invalid;assert.equal(field.bookFontScale(),1);assert.equal(p.searchFontScale(),1);}
assert.match(pageSource,/Flex\(\{ direction: FlexDirection\.Row, wrap: FlexWrap\.Wrap, alignItems: ItemAlign\.Center \}\) \{\s*Text\('找到 '/,'statistics reflow inside the measured fixed header at narrow large fonts');
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const successor=JSON.parse(readFileSync(new URL('./fixtures/design/search-system-font-scale-successor-20261015.json',import.meta.url),'utf8'));
const contract=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url),'utf8'));
const producer=contract.producers.find(value=>value.id==='shared-ReaderButton'),previous=successor.previousProducer;
assert.equal(sha(previous),successor.previousProducerSHA256,'old finite producer witness remains immutable');
assert.equal(sha(sharedProducerShape(buttonSource,producer.file)),successor.currentProducerShapeSHA256);
assert.equal(sha(buttonSource),successor.currentProducerSourceSHA256);
assert.deepEqual(producer.shape.types,previous.shape.types);assert.deepEqual(producer.shape.declarations,previous.shape.declarations,'font scaling adds no free public appearance Props');
const sourceFeedbackEdge={file:'features/source/SourceManagementPage.ets',method:'features/source/SourceManagementPage.ets#SourceManagementPage#statusBanner',component:'ReaderButton',specId:"'source-management-retry'",keys:['scheme','specId','label','onAction']};
const sourceFeedbackMatches=previous.consumers.flatMap((value,index)=>JSON.stringify(value)===JSON.stringify(sourceFeedbackEdge)?[index]:[]);
assert.equal(sourceFeedbackMatches.length,1,'the immutable witness already has exactly one catalog retry edge');
const feedbackConsumers=previous.consumers.slice();feedbackConsumers.splice(sourceFeedbackMatches[0]+1,0,sourceFeedbackEdge);
assert.deepEqual(producer.consumers,feedbackConsumers,'the only additional edge is the SDK-proven source import inline re-search action');
assert.ok(producer.sdkProofs.includes('tools/test-source-index-presentation-consumers.mjs'),'the finite additional edge retains its actual SDK interaction proof');
assert.deepEqual(producer.specSources,previous.specSources,'all41 existing style variants stay exact');
assert.equal(producer.shape.styles.length,previous.shape.styles.length,'no new private typography or physical producer slots');
const changed=producer.shape.styles.flatMap((value,index)=>JSON.stringify(value)===JSON.stringify(previous.shape.styles[index])?[]:[value]);
assert.deepEqual(changed.map(value=>[value.owner,value.method,value.property]),[['ReaderButtonFrameModifier','applyNormalAttribute','height'],['ReaderButtonFrameModifier','applyNormalAttribute','responseRegion']], 'only vp frame and response region expressions change; every font tuple stays exact');
assert.equal(producer.fontScaleSuccessorContract,'tools/fixtures/design/search-system-font-scale-successor-20261015.json');
for(const negative of [buttonSource.replace('instance.fontSize(text.fontSizeFp)','instance.fontSize(99)'),buttonSource.replace("this.id.startsWith('search-')",'true')])
 assert.throws(()=>registeredProducerTypographySlots(negative,producer.file,contract),/finite shared physical inputs/, 'font-family scoping or role tuple drift cannot enter the common producer');
console.log('PASS actual SDK search input/action/header: 1–3.2 font scales, phone/tablet, initial/loading/results/empty, measured inset invalidation, local/online scopes, 28vp spinner, halfLeading, IME/action/unmount; no native pixels asserted');
