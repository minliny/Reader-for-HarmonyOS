import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import {choiceRowProbe,choiceSource,resolveReaderChoiceSpec} from './reader-choice-row-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';
import {readerFoundationTokens} from './reader-foundation-control-probe.mjs';
import {selectedProductionValues} from './selected-production-methods.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {readerAppColor} from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as appearance from '../../entry/src/main/ets/features/common/ReaderSelectAppearanceStyle.ts';
import * as timing from '../../entry/src/main/ets/features/common/ProductMotionTiming.ts';
const file=name=>new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url);
const read=name=>readFileSync(file(name),'utf8');
/** Actual finite InlineSelect -> trigger/popup -> choice rows. Platform popup
 * anchoring, text metrics, animation delivery remain explicit caller ports. */
export function inlineSelectSdk({properties=createArkUIPropertyRuntimeProbe(),uiContext,dependencies={}}={}){
 assert.ok(uiContext,'explicit native measurement/animation/font context required');
 const enums=name=>new Proxy({},{get:(_,key)=>name+'.'+String(key)}),curves=new Proxy({},{get:(_,name)=>(...args)=>({nativeCurve:String(name),args})});
 const motion=pureModuleProbe(read('MotionSpec'),'MotionSpec.ets',{...timing,curves,Curve:enums('Curve')},['motionAnimateParam']);
 const choice=choiceRowProbe(resolveReaderChoiceSpec,choiceSource,properties);
 const hooks={...properties.hooks,mountChildren:true,lifecycleChildren:true,allowEmptyBranchAdmission:true,childSources:{...choice.hooks.childSources}};
 const deps={...properties.sdk,...readerFoundationTokens,...readerTypographyRoles,...appearance,...motion,...choice.dependencies,readerAppColor,registerReaderFonts(){},uiContext,Placement:enums('Placement'),Curve:enums('Curve'),...dependencies};
 for(const name of ['ReaderSelect','ReaderSelectPanel','ReaderInlineSelect']){
  const source=read(name);hooks.childSources[name]=source;
  const moduleNames=name==='ReaderSelect'?['TRIGGER_H','SELECT_PAD','CHEVRON_GAP','CHEVRON_W','CHEVRON_H','SELECT_CHROME']:name==='ReaderSelectPanel'?['OPTION_H','SELECT_PAD','CHEVRON_GAP','CHEVRON_W','CHEVRON_H','SELECT_CHROME']:[];
  const values=moduleNames.length?selectedProductionValues(file(name),moduleNames,deps):{};
  deps[name]=createReaderBuilderProbe(source,boundedMembers(source),{...deps,...values},hooks).Component;
 }
 const walk=owner=>[owner,...[...(owner.children?.values()??[])].flatMap(walk)],nodes=owner=>walk(owner).flatMap(actor=>[...(actor.nodes?.values()??[])]);
 return{dependencies:deps,hooks,properties,walk,nodes,
  choose(inline,value){assert.ok(inline instanceof deps.ReaderInlineSelect,'actual InlineSelect host required');const trigger=walk(inline).find(actor=>actor instanceof deps.ReaderSelect);assert.ok(trigger);const hit=nodes(trigger).find(node=>typeof node.onClick==='function');assert.ok(hit);hit.onClick();properties.flush();assert.equal(inline.open,true);const identity=inline.selectionId;inline.reduceMotion=true;inline.menu(identity);properties.flush();const panel=walk(inline).find(actor=>actor instanceof deps.ReaderSelectPanel&&actor.selectionId===identity);assert.ok(panel,'actual popup Builder mounts actual select panel');const row=walk(panel).find(actor=>actor instanceof deps.ReaderChoiceRow&&actor.label===value);assert.ok(row,'actual selected choice row');const action=nodes(row).find(node=>typeof node.onClick==='function');assert.ok(action);action.onClick();properties.flush();return{identity,panel,row};}
 };
}
