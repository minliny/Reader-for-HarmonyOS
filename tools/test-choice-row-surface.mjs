import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {choiceRowProbe,resolveReaderChoiceSpec,choiceSource} from './lib/reader-choice-row-probe.mjs';

const read=file=>readFileSync(new URL(`../entry/src/main/ets/features/${file}.ets`,import.meta.url),'utf8');
function settings(tablet,resolve=resolveReaderChoiceSpec) {
  const shared=choiceRowProbe(resolve),commits=[];
  const source=read('settings/SettingsSelectOverlay');
  const {owner}=createReaderBuilderProbe(source,
    ['phoneOption','tabletOption','isSelected','ownsOpening','choose','dismiss'],shared.dependencies,shared.hooks);
  Object.assign(owner,{mounted:true,closed:false,field:'language',selectionId:'language:1',value:'中文',options:['中文','English'],appThemeScheme:'day',
    onSelect:option=>commits.push(option),onDismiss:()=>commits.push('dismiss')});
  tablet?owner.tabletOption('中文',0):owner.phoneOption('中文',0);
  return {owner,shared,commits,nodes:()=>shared.nodes(owner),child:[...owner.children.values()][0]};
}
function inline(variant,selected=true,resolve=resolveReaderChoiceSpec) {
  const shared=choiceRowProbe(resolve),commits=[];
  const source=read('common/ReaderSelectPanel');
  const {owner}=createReaderBuilderProbe(source,
    ['appearanceLibraryOption','selectedRow','optionRow','renderedValue','renderedOptions','selectAndCollapse','collapsePanel','finishCollapse'],
    {...shared.dependencies,OPTION_H:36,motionAnimateParam:(_id,onFinish)=>({onFinish})},shared.hooks);
  Object.assign(owner,{value:'中文',options:['中文','English'],variant,appThemeScheme:'day',mounted:true,closeInFlight:false,
    generation:0,reduceMotion:true,selectionId:'field-1',chevronAngle:-180,expandedHeight:72,
    resolvedWidth:()=>180,onCommit:option=>commits.push(option),onDismiss:()=>{}});
  variant==='appearanceLibrary'?owner.appearanceLibraryOption('中文'):selected?owner.selectedRow():owner.optionRow('English');
  return {owner,shared,commits,nodes:()=>shared.nodes(owner),child:[...owner.children.values()][0]};
}

const cases=[
  ['settings-phone',()=>settings(false),52,15,18,16],
  ['settings-tablet',()=>settings(true),42,14,16.8,14],
  ['appearance-library',()=>inline('appearanceLibrary'),25,11,13,11],
  ['default-selected',()=>inline('default'),36,12,undefined,12],
  ['source-group-selected',()=>inline('sourceGroup'),36,12,14.52,12],
  ['appearance-compact-selected',()=>inline('appearanceCompact'),36,12,14.4,8],
  ['default-option',()=>inline('default',false),36,12,undefined,0],
  ['source-group-option',()=>inline('sourceGroup',false),36,12,14.52,0],
];
for(const [id,render,height,size,line,iconWidth] of cases) {
  const view=render(),text=view.nodes().find(n=>n.type==='Text');
  assert.equal(view.child.constructor,view.shared.Component,`${id}: real parent constructs shared production row`);
  assert.equal(text.fontSize,size,`${id}: preserves current size`);
  assert.equal(text.lineHeight,line,`${id}: preserves current line box`);
  const calls=view.child.attributeCalls.filter(call=>call.id===text.id),spec=resolveReaderChoiceSpec(view.child.specId);
  assert.equal(calls.some(call=>call.property==='lineHeight'),line!==undefined,`${id}: AUTO means setter is absent, not undefined`);
  if(spec.layout==='row'){
    assert.equal(calls.some(call=>call.property==='textAlign'),spec.textAlignStart,`${id}: native text alignment AUTO`);
    assert.equal(calls.some(call=>call.property==='textOverflow'),spec.ellipsis,`${id}: native overflow AUTO`);
    assert.deepEqual(calls.find(call=>call.property==='fontWeight').args.length,spec.variableWeight?2:1,`${id}: optional font-weight settings are omitted unless authored`);
  }
  assert.ok(!calls.some(call=>['fontFamily','fontWeight','fontSize','lineHeight','textAlign','textOverflow'].includes(call.property)&&call.args.some(arg=>arg===undefined)),`${id}: no explicit undefined native attribute`);
  assert.equal(view.nodes().find(n=>n.onClick).height,id.startsWith('settings')?height-1:height);
  const image=view.nodes().find(n=>n.type==='Image');
  assert.equal(image?.width??0,iconWidth,`${id}: keeps authored icon geometry`);
  if(id==='source-group-selected')assert.deepEqual(text.position,{x:14,y:10});
  if(id==='appearance-compact-selected')assert.deepEqual(text.position,{x:10,y:11});
  const click=view.nodes().find(n=>n.onClick).onClick;
  click();click();assert.equal(view.commits.length,1,`${id}: owner rejects duplicate commit`);
}

// Common role changes flow through actual consumers; a finite variant change
// remains confined to that row family. This uses the installed SDK-emitted
// property/runtime closures, not a reimplemented renderer.
const changed=id=>{
  const current=resolveReaderChoiceSpec(id);
  return {...current,height:current.height+(id==='settings-tablet'?7:0),
    text:{...current.text,fontSizeFp:current.text.fontSizeFp+2},
    selectedText:{...current.selectedText,fontSizeFp:current.selectedText.fontSizeFp+2}};
};
for(const [render,expectedHeight] of [[()=>settings(false,changed),51],[()=>settings(true,changed),48],[()=>inline('default',true,changed),36]]) {
  const view=render();assert.equal(view.nodes().find(n=>n.onClick).height,expectedHeight);
  assert.equal(view.nodes().find(n=>n.type==='Text').fontSize,resolveReaderChoiceSpec(view.child.specId).text.fontSizeFp+2);
}
{
  const view=settings(false),child=view.child,click=view.nodes().find(n=>n.onClick).onClick;
  view.owner.value='English';view.owner.onSelect=value=>view.commits.push(`fresh:${value}`);
  view.owner.replay();view.shared.properties.flush();
  assert.equal([...view.owner.children.values()][0],child,'retained real child gets updated Props');
  assert.equal(child.selected,false);
  click();assert.deepEqual(view.commits,['fresh:中文']);
  view.owner.closed=false;view.owner.mounted=false;click();assert.equal(view.commits.length,1,'retired owner ignores retained callback');
  view.owner.mounted=true;child.aboutToDisappear();click();assert.equal(view.commits.length,1,'retired shared row rejects a native callback');
}
// These negative controls execute altered actual production modifiers and
// actual SDK Text observers. Getter equality alone would miss undefined calls.
for(const [id,source,property]of[
 ['default-selected',choiceSource.replace('if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);','instance.lineHeight(text.lineHeightFp);'),'lineHeight'],
 ['settings-phone',choiceSource.replace('if (spec.textAlignStart) instance.textAlign(TextAlign.Start);','instance.textAlign(spec.textAlignStart ? TextAlign.Start : undefined);'),'textAlign'],
 ['settings-tablet',choiceSource.replace('if (spec.ellipsis) instance.textOverflow({ overflow: TextOverflow.Ellipsis });','instance.textOverflow(spec.ellipsis ? { overflow: TextOverflow.Ellipsis } : undefined);'),'textOverflow'],
]){
 assert.notEqual(source,choiceSource,'mutation binds actual source');const shared=choiceRowProbe(resolveReaderChoiceSpec,source),child=new shared.Component(undefined,{specId:id,label:'负控',selected:true});child.aboutToAppear();child.initialRender();const text=shared.nodes(child).find(node=>node.type==='Text');
 assert.throws(()=>assert.equal(child.attributeCalls.some(call=>call.id===text.id&&call.property===property),false),/strictly equal/,'explicit undefined setter cannot pass AUTO contract '+property);
 assert.equal(child.attributeCalls.find(call=>call.id===text.id&&call.property===property).args[0],undefined,'actual negative SDK native call carries undefined');
}
console.log('PASS shared choice rows: 8 finite current-UI variants, two production families, SDK Prop updates, guarded intent, common/variant propagation');
