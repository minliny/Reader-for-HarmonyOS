import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'failure-roles':{description:'Actual failure-page branches consume current message roles and hide diagnostic field',resources:[]},'role-grammar':{description:'Bounded shared role expression grammar rejects private numeric/mixed-role additions',resources:[]}});
async function run(id){
const {default:assert}=await import('node:assert/strict');
const {auditTypographyConsumers,isSharedTypographyExpression}=await import('./lib/reader-typography-consumer-audit.mjs');
if(id==='role-grammar'){
for(const expression of ['readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontSizeFp, this.p())','Math.round(readerControlLerp(TYPE_A.fontWeight, TYPE_B.fontWeight, this.p()))'])assert.equal(isSharedTypographyExpression(expression),true);
for(const expression of ['readerControlLerp(TYPE_A.fontSizeFp, 10, this.p())','readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontWeight, this.p())','readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontSizeFp, this.p()+.1)','TYPE_A.fontSizeFp + 2','Math.round(TYPE_A.fontWeight + 2)'])assert.equal(isSharedTypographyExpression(expression),false);
return;
}
const {readFileSync}=await import('node:fs');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const failureSource=readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'utf8');
function checkFailureCarrier(source){
 const actors=auditTypographyConsumers(source,'entry/src/main/ets/features/reading/LocalReadingExperience.ets').filter(n=>n.method==='readingFailureContent'&&n.kind==='Text');
 const title=actors.filter(n=>n.text==="this.sourceSwitchFailureMessage.length > 0 ? '换源未完成' : '正文暂时无法显示'");
 const body=actors.filter(n=>n.text==='this.sourceSwitchFailureMessage.length > 0 ? this.sourceSwitchFailureMessage : this.failureHint');
 assert.equal(title.length,1,'one actual failure title');assert.equal(body.length,1,'one public failure hint; never diagnostic code');
 for(const [actor,role,isTitle]of [[title[0],'MESSAGE_TITLE',true],[body[0],'MESSAGE_BODY',false]]){
  assert.deepEqual(Object.fromEntries(Object.entries(actor.modifiers).map(([k,v])=>[k,v.expression])),{fontFamily:role+'.fontFamily',fontSize:role+'.fontSizeFp',lineHeight:role+'.lineHeightFp as number',...(isTitle?{fontWeight:role+'.fontWeight'}:{})},'current failure actors use public role without extra private values');
 }
}
checkFailureCarrier(failureSource);
assert.throws(()=>checkFailureCarrier(failureSource.replace('this.sourceSwitchMessageNeverUsed','unused').replace('this.sourceSwitchFailureMessage : this.failureHint','this.sourceSwitchFailureMessage : this.failureCode')),/public failure hint/);
assert.throws(()=>checkFailureCarrier(failureSource.replace('.fontSize(MESSAGE_TITLE.fontSizeFp)','.fontSize(MESSAGE_TITLE.fontSizeFp + 1)')),/current failure actors/);
const failureNative=(switchFailure,roles={})=>{
  const sdk=boundedSurfaceSdk({typographyRoles:roles}),owner=sdk.consumer(failureSource,['readingFailureContent'],{
    LOCAL_READING_SOURCE_ID:'local',readerAppearanceThemeStyle:()=>({ink:'#123456',paperStart:'#fff'})});
  Object.assign(owner,{appThemeScheme:'day',sourceId:'local',sourceSwitchFailureMessage:switchFailure?'换源请求失败':'',failureHint:'请重新载入正文',failureCode:'PRIVATE_DIAGNOSTIC_919',
    appearanceSnapshot:{activeTheme:'paper'},readerRecoveryView:{visible:false,canRetry:false},sourceSwitchScopeId:9,
    readingLayout:()=>({bodyWidth:()=>350,bodyHeight:()=>600,contentLeft:0,contentTop:0}),
    retryReading(){},openReaderControl(){},onRetryFailedSourceSwitch(){},onDismissSourceSwitchFailure(){}});
  owner.readingFailureContent();
  const nodes=sdk.nodes(owner),title=nodes.find(n=>n.type==='Text'&&n.create===(switchFailure?'换源未完成':'正文暂时无法显示')),
    body=nodes.find(n=>n.type==='Text'&&n.create===(switchFailure?'换源请求失败':'请重新载入正文'));
  assert.ok(title&&body,'the actual owner renders the exact current title/body branch');
  assert.ok(sdk.walk(owner).some(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label==='重试'),
    'the actual owning page still mounts its real recovery action');
  assert.equal(nodes.some(n=>typeof n.create==='string'&&n.create.includes('PRIVATE_DIAGNOSTIC_919')),false,'diagnostic field never becomes user text');
  return {title,body};
};
for(const switchFailure of [false,true]){
  const native=failureNative(switchFailure);
  assert.deepEqual([native.title.fontSize,native.title.lineHeight,native.title.fontWeight],[readerTypographyRoles.MESSAGE_TITLE.fontSizeFp,readerTypographyRoles.MESSAGE_TITLE.lineHeightFp,readerTypographyRoles.MESSAGE_TITLE.fontWeight]);
  assert.deepEqual([native.body.fontSize,native.body.lineHeight,native.body.fontWeight],[readerTypographyRoles.MESSAGE_BODY.fontSizeFp,readerTypographyRoles.MESSAGE_BODY.lineHeightFp,undefined]);
  const changed=failureNative(switchFailure,{MESSAGE_TITLE:{...readerTypographyRoles.MESSAGE_TITLE,fontSizeFp:19},
    MESSAGE_BODY:{...readerTypographyRoles.MESSAGE_BODY,fontSizeFp:15}});
  assert.equal(changed.title.fontSize,19);assert.equal(changed.body.fontSize,15,
    'both real current page actors actively consume their public message roles');
}

}
// The 24 historical synthetic tuple carriers are withdrawn from callable production gates;
// original evidence remains in the implementation/before archive, not a current requirement.
for(const id of selected){await run(id);recordContractCasePass(id);}
