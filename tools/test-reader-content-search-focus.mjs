import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as motion from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets',import.meta.url),'utf8');
const {Component}=createReaderBuilderProbe(source,['queryInputId','queryInputMounted','focusQueryField','searchField','frame','presentation'],
  {...geometry,...motion,readerContentSearchInputSequence:0});
const requests=[];
const create=()=>Object.assign(new Component(undefined,{}),{motionProgress:1,availableWidth:338,availableHeight:666,
  interactionEnabled:true,queryInputMounted:true,query:'保留查询',getUIContext:()=>({getFocusController:()=>({requestFocus:id=>requests.push(id)})}),
  onQueryChange(){throw Error('focus cannot mutate query');},onSearch(){throw Error('focus cannot submit');}});
const first=create(),second=create();assert.notEqual(first.queryInputId,second.queryInputId,'component instances own unique native focus ids');
first.searchField();second.searchField();
const field=[...first.nodes.values()].find(node=>node.type==='Row'),input=[...first.nodes.values()].find(node=>node.type==='TextInput');
assert.equal(input.id,first.queryInputId);assert.equal(input.borderRadius,0,'the native 14vp input must not inherit a rounded shell');assert.equal(input.height,14);assert.equal(input.enableKeyboardOnFocus,true);
assert.equal(field.height,32);assert.equal(field.width,first.frame().field.width);
field.onClick();assert.deepEqual(requests,[first.queryInputId]);assert.equal(first.query,'保留查询');
second.nodes.get(0).onClick();assert.deepEqual(requests,[first.queryInputId,second.queryInputId]);
first.interactionEnabled=false;field.onClick();assert.equal(requests.length,2,'disabled/morph-owned field cannot acquire IME');
first.interactionEnabled=true;first.queryInputMounted=false;field.onClick();assert.equal(requests.length,2,'removed field cannot steal focus');
first.queryInputMounted=true;first.getUIContext=()=>{throw Error('context detached');};assert.doesNotThrow(()=>field.onClick());
first.getUIContext=()=>({getFocusController:()=>({requestFocus(){throw Error('native focus failed');}})});assert.doesNotThrow(()=>field.onClick());
console.log('PH90 actual SDK field Builder: full visual field requests unique native input focus, disabled/unmounted/failure guards; geometry unchanged PASS (not native IME acceptance)');
