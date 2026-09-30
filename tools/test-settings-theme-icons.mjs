import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/settings/SettingsPage.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(sdk+'/lib/validate_ui_syntax.js'),ts=require(sdk+'/node_modules/typescript');
for(const [name,props] of [['CategoryRow',['icon','label']],['ReaderToggle',['value','radius']]]){syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set(props));}
syntax.builderParamObjectCollection.set('CategoryRow',new Set(['content']));
class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const {owner}=createReaderBuilderProbe(source,['iconBox','switchRow'],{CategoryRow:Child,ReaderToggle:Child});
Object.assign(owner,{appThemeScheme:'day',settingValue:()=>false,toggleSetting:()=>{}});
const tree=ts.createSourceFile('SettingsPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const calls=[];function walk(n){if(ts.isCallExpression(n)&&['segmentRow','switchRow'].includes(n.expression?.name?.text))calls.push(n);ts.forEachChild(n,walk);}walk(tree);
const rows=[['App主题','settings_gen_theme'],['自动检查更新','settings_gen_update'],['减少动态效果','settings_gen_motion']];
for(const [label] of rows){const call=calls.find(c=>c.arguments[0].text===label);assert.ok(call);const expression=stripTypeScriptTypes(`const value=${call.arguments[1].getText(tree)};`);const icon=new Function('$r',expression+' return value;').call(owner,x=>x);if(label==='App主题')owner.iconBox(icon);else owner.switchRow(label,icon,label==='自动检查更新'?'autoCheckUpdate':'reduceMotion');}
for(const scheme of ['day','night','day']){
 owner.appThemeScheme=scheme;owner.replay();
 const actual=[[...owner.nodes.values()].find(n=>n.type==='Image').create,...[...owner.children.values()].filter(c=>c.params.label).map(c=>c.params.icon)];
 assert.deepEqual(actual,rows.map(([,name])=>'app.media.'+name+(scheme==='night'?'_theme_night':'')),'retained concrete image and child Prop receive current theme resources');
}
console.log('PASS Settings real SDK retained icon/CategoryRow updates from actual call-site expressions Day/Night/Day');
