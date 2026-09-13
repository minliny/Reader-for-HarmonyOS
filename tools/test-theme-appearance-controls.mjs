import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const file = name=>new URL(`../entry/src/main/ets/features/${name}.ets`,import.meta.url);
const {owner}=createReaderBuilderProbe(readFileSync(file('reading/ReaderControlAppearanceContent'),'utf8'),['stepperRow','stepButton'],{readerAppearanceCanStep:()=>true});
Object.assign(owner,{appThemeScheme:'day',frame:()=>({sectionWidth:316}),metricLabel:()=> '字号',metricValue:()=> '18',fullInput:()=>true,snapshot:{}});
owner.stepperRow('fontSize',100);
for(const scheme of ['day','night','day']){
 owner.appThemeScheme=scheme;owner.replay();
 const field=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.width===98);
 assert.equal(field.backgroundColor,readerAppColor('app.appearance.selectSurface',scheme));
 assert.equal(field.border.color,readerAppColor('app.appearance.selectBorder',scheme));
 assert.equal(field.height,27);assert.equal(field.borderRadius,8);
 const value=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='18');
 assert.equal(value.fontColor,readerAppColor('TOK_READ_INK',scheme));
}
const {owner:select}=createReaderBuilderProbe(readFileSync(file('common/ReaderSelect'),'utf8'),['appearanceLibraryTrigger']);
Object.assign(select,{appThemeScheme:'day',value:'原文',isOpen:false,dropdownAnimation:()=>undefined});
const savedContext=globalThis.Context;
globalThis.Context={animation(){}};
select.appearanceLibraryTrigger();
for(const scheme of ['day','night','day'])for(const open of [false,true]){
 select.appThemeScheme=scheme;select.isOpen=open;select.replay();
 const row=[...select.nodes.values()].find(n=>n.type==='Row');
 assert.equal(row.backgroundColor,readerAppColor(open?'app.appearance.selectOpenFill':'app.appearance.selectFill',scheme));
}
const Panel=productionMotionMethods(file('common/ReaderSelectPanel'),['panelBackgroundColor','panelBorderColor']);
for(const scheme of ['day','night']){
 const p=Object.assign(new Panel(),{variant:'appearanceLibrary',appThemeScheme:scheme});
 assert.equal(p.panelBackgroundColor(),readerAppColor('app.appearance.selectSurface',scheme));
 assert.equal(p.panelBorderColor(),readerAppColor('app.appearance.selectBorder',scheme));
}
const {owner:topBar}=createReaderBuilderProbe(readFileSync(file('common/AppTopBar'),'utf8'),['trailing','build'],{
  TYPE_APP_HOME_TITLE:{fontFamily:'title',fontWeight:700,fontSizeFp:29,lineHeightFp:36}});
Object.assign(topBar,{title:'书架',divider:true,appThemeScheme:'day',leftInset:()=>20,rightInset:()=>20});
topBar.initialRender();
for(const scheme of ['day','night'])for(const divider of [true,false]){
 topBar.appThemeScheme=scheme;topBar.divider=divider;topBar.replay();
 const row=[...topBar.nodes.values()].find(n=>n.type==='Row');
 assert.equal(row.height,58);assert.equal(row.border.width.bottom,divider?1:0);
 assert.equal(row.border.color,readerAppColor('TOK_LINE_STRONG',scheme));
}
console.log('PASS Appearance fields: retained SDK Day/Night/Day stepper and open/closed trigger paint, menu surface/border roles');

if(savedContext===undefined)delete globalThis.Context;else globalThis.Context=savedContext;
