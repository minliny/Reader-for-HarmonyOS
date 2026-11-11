import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'admission':{description:'Retired motion flag rejection, remaining exact debug cold-start and maintenance admission',resources:[]},
 'ability-consumer':{description:'Actual EntryAbility loadMainContent/Warm Want methods; no window or device',resources:[]},
 'registration':{description:'Retired motion route absent; remaining required pages uniquely registered',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { readFile }=await import('node:fs/promises');
const {
  readerControlVerificationColdStartPage,
  readerRebuildableCacheClearEnabled,
}=await import('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts');

if(selectedCase==='admission'){
const normal = 'pages/Index';
const diagnostic = 'pages/ReaderControlMotionVerification';
const rendererPilot = 'pages/ReaderRendererPilot';
const candidateValues = [undefined, null, false, true, 0, 1, '', 'true', 'TRUE', '1',
  diagnostic, rendererPilot, { readerControlMotionVerification: true }, { route: diagnostic },
  [true], new Boolean(true)];
function assertLaunchPolicy(policy) {
  for (const debug of [false, true]) {
    for (const mode of ['release', '', 'DEBUG', 'debug', 'debug ', 'preview', 'custom']) {
      for (const value of candidateValues) {
        assert.equal(policy(debug, mode, value, undefined), normal,
          'retired motion flag never opens a route');
        const expectedRenderer = debug === true && mode === 'debug' && value === true ? rendererPilot : normal;
        assert.equal(policy(debug, mode, undefined, value), expectedRenderer,
          'remaining renderer pilot requires exact debug cold-start admission');
      }
    }
  }
  assert.equal(policy(true, 'debug', true, true), normal, 'conflicting diagnostics remain isolated');
  assert.equal(policy(true, 'debug', true, false, true), normal, 'retired motion conflicts with startup fault');
  assert.equal(policy(true, 'debug', false, false, true), 'pages/__ReaderStartupMainLoadFailure');
}
assertLaunchPolicy(readerControlVerificationColdStartPage);
// Negative controls execute mutated production policy, not a separate model.
const { stripTypeScriptTypes } = await import('node:module');
const policySource = await readFile(new URL('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts', import.meta.url), 'utf8');
const mutants = [
  policySource.replace("if (motion) return 'pages/Index';", "if (motion) return 'pages/ReaderControlMotionVerification';"),
  policySource.replace("if (debug !== true || buildModeName !== 'debug') return 'pages/Index';", "if (false) return 'pages/Index';"),
  policySource.replace("if ((motion && renderer) || (mainLoadFailure && (motion || renderer))) return 'pages/Index';", "if (false) return 'pages/Index';"),
];
for (const mutant of mutants) {
  assert.notEqual(mutant, policySource, 'negative control must change production source');
  const executable = stripTypeScriptTypes(mutant).replace(/\bexport\s+/g, '');
  const policy = new Function(executable + '; return readerControlVerificationColdStartPage;')();
  assert.throws(() => assertLaunchPolicy(policy), 'mutated production launch policy must fail');
}
assert.equal(readerRebuildableCacheClearEnabled(true, 'debug', true), true);
for (const value of [false, undefined, null, 'true', 1, { enabled: true }])
  assert.equal(readerRebuildableCacheClearEnabled(true, 'debug', value), false,
    'cache maintenance requires an exact debug boolean Want');
assert.equal(readerRebuildableCacheClearEnabled(false, 'debug', true), false);
assert.equal(readerRebuildableCacheClearEnabled(true, 'release', true), false);


return;
}
const normal='pages/Index',diagnostic='pages/ReaderControlMotionVerification',rendererPilot='pages/ReaderRendererPilot';
if(selectedCase==='ability-consumer'){
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');const received=[];
 const Ability=selectedProductionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),'EntryAbility',
 ['loadMainContent','onNewWant'],{ReaderStartupTrace:{current:()=>undefined},ReaderSystemFileOpenHost:{receive:want=>received.push(want)},hilog:{error(){}},DOMAIN:0});
 for(const page of [normal,rendererPilot]){
  const ability=Object.assign(new Ability(),{coldStartPage:page,windowStageGeneration:1}),loads=[],done=[];
  ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:0});}},code=>done.push(code));
  assert.deepEqual(loads,[page]);assert.deepEqual(done,[0]);assert.equal(ability.coldStartPage,page);
  const want={parameters:{readerControlMotionVerification:true,route:'pages/anything'}};ability.onNewWant(want,{});
  assert.equal(received.at(-1),want);assert.equal(ability.coldStartPage,page,'warm Want cannot replace admitted cold destination');assert.equal(loads.length,1);
 }
 const ability=Object.assign(new Ability(),{coldStartPage:'pages/__ReaderStartupMainLoadFailure',windowStageGeneration:1}),loads=[];
 ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:1});}},()=>{});
 ability.loadMainContent({loadContent:(name,callback)=>{loads.push(name);callback({code:0});}},()=>{});
 assert.deepEqual(loads,['pages/__ReaderStartupMainLoadFailure',normal],'fault dispatch is consumed before platform response');
 let late;let completed=0;ability.loadMainContent({loadContent:(_name,callback)=>{late=callback;}},()=>completed++);ability.windowStageGeneration++;late({code:0});assert.equal(completed,0);
}else{
 const pages=JSON.parse(await readFile(new URL('../entry/src/main/resources/base/profile/main_pages.json',import.meta.url),'utf8'));
 function assertRegistration(src){
  assert.equal(new Set(src).size,src.length,'route IDs register uniquely');
  for(const page of [normal,rendererPilot,'pages/ReaderStartupRecovery'])assert.ok(src.includes(page),page+' registered');
  assert.ok(!src.includes(diagnostic),'reference-only motion route must not register');
 }
 assertRegistration(pages.src);
 assert.throws(()=>assertRegistration([...pages.src,diagnostic]),'restoring retired route fails');
 assert.throws(()=>assertRegistration(pages.src.filter(page=>page!==rendererPilot)),'removing remaining diagnostic fails');
}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
