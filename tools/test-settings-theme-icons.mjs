import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/settings/ui/SettingsPage.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(sdk+'/lib/validate_ui_syntax.js'),ts=require(sdk+'/node_modules/typescript');
for(const [name,props] of [['ReaderFormRow',['icon','label']],['ReaderToggle',['value','specId','inputIdentity','accessibilityLabel','actionEnabled','isBusy']]]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set(props));}
syntax.builderParamObjectCollection.set('ReaderFormRow',new Set(['content']));
class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const {owner}=createReaderBuilderProbe(source,['segmentRow','switchRow'],{ReaderFormRow:Child,ReaderToggle:Child});
Object.assign(owner,{temporaryBackIdentity:'theme-icon-page',appThemeScheme:'day',settingCanToggle:()=>true,settingToggleBusy:()=>false,settingValue:()=>false,toggleSetting:()=>{},appThemeControl:()=>{}});
const tree=ts.createSourceFile('SettingsPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const calls=[];function walk(n){if(ts.isCallExpression(n)&&['segmentRow','switchRow'].includes(n.expression?.name?.text))calls.push(n);ts.forEachChild(n,walk);}walk(tree);
const rows=[['App主题','settings_gen_theme'],['自动检查更新','settings_row_download'],['减少动态效果','settings_gen_animation']];
for(const [label] of rows){const call=calls.find(c=>c.arguments[0].text===label);assert.ok(call);const expression=stripTypeScriptTypes(`const value=${call.arguments[1].getText(tree)};`);const icon=new Function('$r',expression+' return value;').call(owner,x=>x);if(label==='App主题')owner.segmentRow(label,icon);else owner.switchRow(label,icon,label==='自动检查更新'?'autoCheckUpdate':'reduceMotion');}
for(const scheme of ['day','night','day']){
 owner.appThemeScheme=scheme;owner.replay();
 const actual=[...owner.children.values()].filter(c=>c.params.label).map(c=>c.params.icon);
 assert.deepEqual(actual,rows.map(([,name])=>'app.media.'+name+(scheme==='night'?'_theme_night':'')),'retained concrete image and child Prop receive current theme resources');
}
console.log('PASS Settings real SDK retained FormRow icons update from actual call-site expressions Day/Night/Day');
