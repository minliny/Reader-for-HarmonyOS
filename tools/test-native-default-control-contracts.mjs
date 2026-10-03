import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { sharedProducerShape } from './lib/architecture-shared-producer-contract.mjs';
import { auditNativeTextElements } from './lib/reader-typography-consumer-audit.mjs';
import { verifyNativeDefaultBranches } from './lib/native-default-control-probe.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/design/native-default-control-contracts.json',import.meta.url)));
const producers=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url)));
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
  if(node.kind==='Text'&&file==='common/ReaderBoundedSurfaceHeader.ets'&&node.method==='titleText'&&node.text==='this.title'&&
    normalise(node.attributes.attributeModifier)==='newReaderBoundedTitleModifier(this.specId,this.appThemeScheme)'){
    const actual=producers.producers.find(p=>p.component==='ReaderBoundedSurfaceHeader');assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'actual finite modifier owns title roles and AUTO omissions');delegated++;continue;
  }
  if(node.kind==='Text'&&file==='common/ReaderButton.ets'&&node.method==='build'&&node.text==='this.label'&&
    ['newReaderButtonLabelModifier(this.specId,this.primary,this.scheme)','newReaderButtonTextModifier(this.specId,this.primary,this.actionEnabled,this.layout,this.scheme)'].includes(normalise(node.attributes.attributeModifier))||
    node.kind==='TextInput'&&file==='common/ReaderFormField.ets'&&node.method==='build'&&normalise(node.text)==='{text:this.text,placeholder:this.placeholder}'&&
    normalise(node.attributes.attributeModifier)==='newReaderFormFieldModifier(this.specId,this.scheme)'){
    const actual=producers.producers.find(p=>p.component===(node.kind==='Text'?'ReaderButton':'ReaderFormField'));assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'actual finite foundation modifier preserves public roles/AUTO');
    assert.ok(node.attributes[node.kind==='TextInput'?'onChange':'onClick']||node.kind==='Text'&&normalise(node.attributes.attributeModifier)==='newReaderButtonLabelModifier(this.specId,this.primary,this.scheme)', 'real event host or finite stacked label');
    delegated++;continue;
  }
  const contract=contracts.get(JSON.stringify([rel,node.method,node.kind,normalise(node.text)]));
  assert.ok(contract,`${rel}:${node.line}: a visible native-default element needs a bounded platform-default contract, not a fake TYPE modifier`);
  assert.equal(node.attributes.attributeModifier, undefined, `${contract.id}: do not add an empty modifier to fake a public migration`);
  assert.ok(++contract.count<=(contract.branchInstances?.length??1),`${contract.id}: prevent copied native default exceptions`);
  for(const[property,value]of Object.entries(contract.requiredAttributes))assert.equal(node.attributes[property],value,`${contract.id}: preserve actual native input geometry`);
  assert.ok(node.attributes[node.kind==='TextInput'?'onChange':'onClick'] && node.attributes[node.kind==='TextInput'?'onChange':'onClick'] !== 'undefined',`${contract.id}: actual action/draft callback remains wired`);controls++;
 }
}
for(const row of contracts.values()){
 assert.equal(row.count,row.branchInstances?.length??1,`${row.id}: native owner/consumer still present; intentional replacement requires a new actual implementation proof`);
 if(row.branchInstances){
  const source=readFileSync(new URL('../entry/src/main/ets/'+row.file,import.meta.url),'utf8');
  assert.equal(verifyNativeDefaultBranches(source,row.file,row),row.branchInstances.length);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace("Button('重试').onClick((): void => this.retryReading());","Button('重试').onClick((): void => this.retryReading()); Button('重试').onClick((): void => this.retryReading());"),row.file,row),/copied native default actors/);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace('this.onRetryFailedSourceSwitch(scopeId)','this.onRetryFailedSourceSwitch(this.sourceSwitchScopeId)'),row.file,row),/exact actual branch callback/);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace('if (this.sourceSwitchFailureMessage.length > 0) {\n          ForEach','if (true) {\n          ForEach'),row.file,row),/exact finite branch guard/);
 }
}
assert.equal(controls,14);assert.equal(a11y,4);assert.equal(delegated,7);
console.log(`PASS native-default contracts: ${contracts.size} finite native families / ${controls} actual actors (retry has exact exclusive source-switch/reading branches); ${paint} no-glyph actors, ${a11y} exact accessibility actors, ${delegated} actual shared Dialog/finite title hosts, ${inherited} inherited body spans; no physical font overrides fabricated`);
