import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { auditNativeTextElements } from './lib/reader-typography-consumer-audit.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/design/native-default-control-contracts.json',import.meta.url)));
const featureRoot=new URL('../entry/src/main/ets/features/',import.meta.url),normalise=text=>(text??'').replace(/\s+/g,'');
const contracts=new Map(fixture.consumers.map(row=>[JSON.stringify([row.file,row.method,row.kind,normalise(row.argument)]),{...row,count:0}]));
assert.equal(contracts.size,13);
let controls=0,paint=0,a11y=0,delegated=0,inherited=0;
for(const file of readdirSync(featureRoot,{recursive:true}).filter(file=>file.endsWith('.ets'))){
 const rel='features/'+file,source=readFileSync(new URL(file,featureRoot),'utf8');
 for(const node of auditNativeTextElements(source,rel)){
  if(Object.keys(node.modifiers).length)continue;
  if(node.kind==='Span'&&node.inheritsTextStyle){inherited++;continue;}
  // No visible glyph exists in a blank paint actor or unlabelled event host.
  if(node.kind==='Text'&&["''",'""'].includes(node.text)||node.kind==='Button'&&node.text===undefined){paint++;continue;}
  if(node.kind==='Text'&&node.attributes.width==='1'&&node.attributes.height==='1'&&node.attributes.accessibilityRole==='AccessibilityRoleType.BUTTON'&&
    node.method==='accessibleControlActions'&&['reading/ReaderControlPanel.ets','reading/ReaderControlMotionStage.ets'].includes(file)){a11y++;continue;}
  if(node.kind==='Button'&&file==='common/ReaderDialogSurface.ets'&&node.method==='actionCell'&&node.attributes.attributeModifier==='this.actionModifier(action)'){
   assert.ok(source.includes('TYPE_DIALOG')||source.includes('this.spec()'),'actual shared Dialog family owns its labelled native child');delegated++;continue;
  }
  const contract=contracts.get(JSON.stringify([rel,node.method,node.kind,normalise(node.text)]));
  assert.ok(contract,`${rel}:${node.line}: a visible native-default element needs a bounded platform-default contract, not a fake TYPE modifier`);
  assert.equal(node.attributes.attributeModifier, undefined, `${contract.id}: do not add an empty modifier to fake a public migration`);
  assert.ok(++contract.count<=1,`${contract.id}: prevent copied native default exceptions`);
  for(const[property,value]of Object.entries(contract.requiredAttributes))assert.equal(node.attributes[property],value,`${contract.id}: preserve actual native input geometry`);
  assert.ok(node.attributes[node.kind==='TextInput'?'onChange':'onClick'] && node.attributes[node.kind==='TextInput'?'onChange':'onClick'] !== 'undefined',`${contract.id}: actual action/draft callback remains wired`);controls++;
 }
}
for(const row of contracts.values())assert.equal(row.count,1,`${row.id}: native owner/consumer still present; intentional replacement requires a new actual implementation proof`);
assert.equal(controls,13);assert.equal(a11y,4);assert.equal(delegated,1);
console.log(`PASS native-default contracts: ${controls} real native controls / three finite variants; ${paint} no-glyph actors, ${a11y} exact accessibility actors, ${delegated} shared Dialog host, ${inherited} inherited body spans; no physical font overrides fabricated`);
