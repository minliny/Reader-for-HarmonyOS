import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { verifyArchitectureRegistration, registeredProducerTypographySlots } from './lib/architecture-shared-producer-contract.mjs';
const root=process.cwd(),baseline=JSON.parse(readFileSync('tools/architecture-consumer-baseline.json','utf8')),contract=JSON.parse(readFileSync('tools/fixtures/architecture-shared-producers.json','utf8'));
const inventory=JSON.parse(execFileSync(process.execPath,['tools/audit-architecture-consumers.mjs','--stdout=json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','ignore']}));
const result=verifyArchitectureRegistration(inventory,baseline,contract,root);
for(const novelFile of ['entry/src/main/ets/features/source/SourceSwitchWindow.ets','entry/src/main/ets/features/source/SourceSwitchProgress.ets']){
 const source=readFileSync(novelFile,'utf8'),role=novelFile.endsWith('/SourceSwitchWindow.ets')?'TOK_SS_WINDOW_BG':'TOK_SS_PROGRESS_BG';
 const changed=source.replace(`readerAppColor('${role}', this.appThemeScheme)`,"readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)");assert.notEqual(changed,source);
 assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===novelFile?changed:readFileSync(file,'utf8')),
  /exact selected novel source background carriers changed/,'same-count selected novel private background change rejects');
 const inflated=structuredClone(baseline);inflated.uiPolicies.find(row=>row.file===novelFile).counts.backgroundColor++;
 assert.throws(()=>verifyArchitectureRegistration(inventory,inflated,contract,root),/exact selected novel source background budget/,'selected design witness does not permit a higher background budget');
 const missingWitness=structuredClone(baseline);delete missingWitness.uiPolicies.find(row=>row.file===novelFile).visualSuccessorContract;
 assert.throws(()=>verifyArchitectureRegistration(inventory,missingWitness,contract,root),/binds exact witness/,'new selected actor keeps an explicit finite successor contract');
}
assert.equal(result.budgetRows,93,'original retained business budgets');assert.equal(result.transferredBudgetRows,7);assert.equal(result.historicalBudgetRows,100,'93 + seven exact reversible approved transfers preserve all original100');assert.equal(result.producers,16);
assert.deepEqual(contract.producers.map(row=>row.component).sort(),['ReaderBoundedSurface','ReaderBoundedSurfaceActions','ReaderBoundedSurfaceHeader','ReaderButton','ReaderFormField','ReaderLabeledIconAction','ReaderSheetActionList','ReaderChoiceRow','RssOriginalRecoverySurface','ReaderCard','ReaderToggle','ReaderSegmentedControl','ReaderIconButton','ReaderMangaDownloadPopup','MangaDirectoryEntryRow','MangaDirectoryCurrentFooter'].sort(),'only exact finite shared producers gain owner treatment');
const mangaRowPath='entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets',mangaRowSource=readFileSync(mangaRowPath,'utf8');
const mangaRowProducer=contract.producers.find(row=>row.component==='MangaDirectoryEntryRow');
assert.deepEqual(mangaRowProducer.consumers.map(edge=>edge.file).sort(),['features/bookshelf/BookDirectoryPage.ets','features/bookshelf/LocalBookDetail.ets','features/manga/MangaReadingDirectoryFallback.ets'].sort());
const alteredMangaRow=mangaRowSource.replace('.fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize)','.fontSize(99)');
assert.notEqual(alteredMangaRow,mangaRowSource,'negative control edits an actual generated visual input');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===mangaRowPath?alteredMangaRow:readFileSync(file,'utf8')),/finite shared physical inputs/,'new shared directory row cannot hide a private99 font at unchanged call count');
const illegalMangaRow=structuredClone(inventory),mangaCaller=illegalMangaRow.rows.find(row=>row.file==='features/bookshelf/BookDirectoryPage.ets').elements.find(element=>element.kind==='MangaDirectoryEntryRow');
assert.ok(mangaCaller);mangaCaller.args[0]=mangaCaller.args[0].replace(/\{\s*/,'{ fontSize: 99, ');
assert.throws(()=>verifyArchitectureRegistration(illegalMangaRow,baseline,contract,root),/illegal shared input/,'new directory row rejects a caller-owned typography override');
const footerPath='entry/src/main/ets/features/manga/MangaDirectoryCurrentFooter.ets',footerSource=readFileSync(footerPath,'utf8');
const footerProducer=contract.producers.find(row=>row.component==='MangaDirectoryCurrentFooter');
assert.deepEqual(footerProducer.consumers.map(edge=>edge.file).sort(),['features/bookshelf/BookDirectoryPage.ets','features/manga/MangaReadingSurface.ets'].sort());
const alteredFooter=footerSource.replace('.fontSize(visual.footerMetaFontSize)','.fontSize(99)');
assert.notEqual(alteredFooter,footerSource);
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===footerPath?alteredFooter:readFileSync(file,'utf8')),/finite shared physical inputs/,'shared footer literal99 is rejected at unchanged call count');
const illegalFooter=structuredClone(inventory),footerCaller=illegalFooter.rows.find(row=>row.file==='features/bookshelf/BookDirectoryPage.ets').elements.find(element=>element.kind==='MangaDirectoryCurrentFooter');
assert.ok(footerCaller);footerCaller.args[0]=footerCaller.args[0].replace(/\{\s*/,'{ fontSize: 99, ');
assert.throws(()=>verifyArchitectureRegistration(illegalFooter,baseline,contract,root),/illegal shared input/,'shared footer admits reading facts and measured width, never typography overrides');
const visualPath='entry/src/main/ets/features/manga/MangaDirectoryVisual.ts',visualSource=readFileSync(visualPath,'utf8');
const alteredVisual=visualSource.replace('namedFontSize: 13','namedFontSize: 99');assert.notEqual(alteredVisual,visualSource);
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===visualPath?alteredVisual:readFileSync(file,'utf8')),/finite shared spec source/,'generated visual values are exact closed producer inputs');
const pressPath='entry/src/main/ets/features/manga/MangaDirectoryPressFeedback.ets',pressSource=readFileSync(pressPath,'utf8');
const alteredPress=pressSource.replace('MANGA_DIRECTORY_VISUAL.pressOpacity','1');assert.notEqual(alteredPress,pressSource);
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===pressPath?alteredPress:readFileSync(file,'utf8')),/finite shared spec source/,'the finite platform press adapter is pinned as a spec source, without gaining a UI budget exemption');
const header='entry/src/main/ets/features/common/ReaderBoundedSurfaceHeader.ets',original=readFileSync(header,'utf8');
const read=file=>file===header?original.replace('.fontSize(type.fontSizeFp)','.fontSize(99)'):readFileSync(file,'utf8');
assert.notEqual(read(header),original);assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,read),/finite shared physical inputs/,'same font call count cannot hide a private literal in a shared alias');
assert.equal(registeredProducerTypographySlots(original,header,contract).has('applyNormalAttribute','fontSize','type.fontSizeFp'),true);
assert.equal(registeredProducerTypographySlots(original,header,contract).has('applyNormalAttribute','fontSize','99'),false);
assert.equal(registeredProducerTypographySlots(original,'entry/src/main/ets/features/common/UnknownHeader.ets',contract).size,0,'common location is not a producer contract');
const changedRole=original.replace('const type = this.id', 'const type = { fontFamily: "PrivateFont", fontSizeFp: 99, fontWeight: 700 }; const abandoned = this.id');
assert.throws(()=>registeredProducerTypographySlots(changedRole,header,contract),/role bindings changed/,'same alias and call count cannot disguise a changed role binding');
const raised=structuredClone(baseline);raised.rows[0].counts.fontSize++;assert.throws(()=>verifyArchitectureRegistration(inventory,raised,contract,root),/original business budget changed|private budgets cannot be silently raised/);
const wildcard=structuredClone(baseline);wildcard.sharedOwners.push({file:'entry/src/main/ets/features/common/*',counts:{fontSize:999}});
assert.throws(()=>verifyArchitectureRegistration(inventory,wildcard,contract,root),/exact legacy owner|no wildcard/);
const arbitrary=structuredClone(baseline);arbitrary.sharedOwners.push({file:'entry/src/main/ets/features/common/UnknownHeader.ets',counts:{fontSize:999},reason:'new common exemption'});
assert.throws(()=>verifyArchitectureRegistration(inventory,arbitrary,contract,root),/exact legacy owner/,'a concrete common path cannot obtain shared exemption without an exact contract');
const missing=structuredClone(baseline);missing.uiPolicies=missing.uiPolicies.filter(r=>!r.file.endsWith('/CategorySection.ets'));
assert.throws(()=>verifyArchitectureRegistration(inventory,missing,contract,root),/unregistered actual UI file/,'zero-style UI cannot disappear from registration');
const illegal=structuredClone(inventory);const row=illegal.rows.find(r=>r.file==='features/reading/ReaderTtsConfigOverlay.ets'),call=row.elements.find(e=>e.kind==='ReaderBoundedSurfaceHeader');
assert.ok(call,'actual retained TTS header remains a shared consumer');call.args[0]=call.args[0].replace(/\{\s*/, '{ fontSize: 99, ');
assert.throws(()=>verifyArchitectureRegistration(illegal,baseline,contract,root),/illegal shared input/);
for(const property of ['width','height','padding','maxHeight','radius']){
 const bad=structuredClone(inventory),site=bad.rows.find(r=>r.file==='features/bookshelf/BookDirectoryPage.ets').elements.find(e=>e.kind==='ReaderMangaDownloadPopup');
 assert.ok(site);site.args[0]=site.args[0].replace(/\{\s*/,'{ '+property+': 99, ');
 assert.throws(()=>verifyArchitectureRegistration(bad,baseline,contract,root),/illegal shared input/,'download popup exposes only business state and measured width, no style bag '+property);
}
const popupPath='entry/src/main/ets/features/common/ReaderMangaDownloadPopup.ets',popupSource=readFileSync(popupPath,'utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===popupPath?popupSource.replace('.width(this.spec().anchorSize)','.width(99)'):readFileSync(file,'utf8')),/finite shared physical inputs/,'same-count popup geometry99 cannot bypass the fixed recipe');
const popupSpecPath='entry/src/main/ets/features/common/ReaderMangaDownloadPopupSpec.ts',popupSpecSource=readFileSync(popupSpecPath,'utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===popupSpecPath?popupSpecSource.replace('= 240','= 99'):readFileSync(file,'utf8')),/finite shared spec source/,'fixed tuple source is part of the exact producer contract');
const panelPath='entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets',panelSource=readFileSync(panelPath,'utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===panelPath?panelSource.replace('.fontSize(13)','.fontSize(99)'):readFileSync(file,'utf8')),/actual shared delegate implementation changed/,'unchanged existing manga content font is a concrete delegation contract');
const unknownPopup=structuredClone(inventory),popupCall=unknownPopup.rows.find(r=>r.file==='features/bookshelf/BookDirectoryPage.ets').elements.find(e=>e.kind==='ReaderMangaDownloadPopup');
popupCall.args[0]=popupCall.args[0].replace("'manga-download'","'private99'");
assert.throws(()=>verifyArchitectureRegistration(unknownPopup,baseline,contract,root),/producer\/consumer\/spec edges changed/,'unknown popup spec is rejected statically as well as at runtime');
const outerPopup=structuredClone(inventory);outerPopup.rows.find(r=>r.file==='features/bookshelf/BookDirectoryPage.ets').elements.find(e=>e.kind==='ReaderMangaDownloadPopup').modifiers.push({property:'width',args:['99']});
assert.throws(()=>verifyArchitectureRegistration(outerPopup,baseline,contract,root),/caller privately overrides shared appearance/,'caller cannot add a geometry override around the finite popup');
const lostTransition=structuredClone(baseline);lostTransition.uiPolicies.find(r=>r.file.endsWith('/BookDirectoryPage.ets')).supersededLegacyCounts.fontSize++;
assert.throws(()=>verifyArchitectureRegistration(inventory,lostTransition,contract,root),/exact original counts/,'policy transfer cannot erase or raise the historical budget');
for(const file of contract.legacyBusinessBudgetOrigins.transferredPaths){
 const wrongKind=structuredClone(baseline),policy=wrongKind.uiPolicies.find(r=>r.file===file);
 const otherKind=baseline.uiPolicies.find(r=>contract.legacyBusinessBudgetOrigins.transferredPaths.includes(r.file)&&r.kind!==policy.kind).kind;
 policy.kind=otherKind;
 assert.throws(()=>verifyArchitectureRegistration(inventory,wrongKind,contract,root),/no arbitrary reclassification/,'another approved kind cannot be reused for this exact path '+file);
}
const wrongTransferPath=structuredClone(contract);
const directoryTransfer=wrongTransferPath.legacyBusinessBudgetOrigins.transferredPaths.indexOf('entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets');
assert.ok(directoryTransfer>=0);wrongTransferPath.legacyBusinessBudgetOrigins.transferredPaths[directoryTransfer]='entry/src/main/ets/features/unknown/BookDirectoryPage.ets';
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,wrongTransferPath,root),/full-path policy migrations/,'same basename elsewhere cannot inherit the exact approved transfer');
const missingRssDelegate=structuredClone(inventory),rssWrapper=missingRssDelegate.rows.find(row=>row.file==='features/rss/RssOriginalRecoverySurface.ets');
assert.ok(rssWrapper);const actualAction=rssWrapper.elements.findIndex(element=>element.kind==='ReaderRecoveryAction');assert.ok(actualAction>=0);rssWrapper.elements.splice(actualAction,1);
assert.throws(()=>verifyArchitectureRegistration(missingRssDelegate,baseline,contract,root),/actual shared delegate edges changed/,'five incoming Page rows cannot hide a missing shared action implementation');
assert.equal(contract.retainedConsumerSlots.length,1);
const directorySlot=contract.retainedConsumerSlots[0];
assert.deepEqual(directorySlot.components.map(child=>[child.component,child.consumers.length]),[['ReaderRecoveryNotice',1],['ReaderRecoveryAction',4]]);
const incompleteDirectory=structuredClone(inventory),directoryRow=incompleteDirectory.rows.find(row=>row.file==='features/reading/ReaderDirectoryRules.ets');
const refresh=directoryRow.elements.findIndex(element=>element.kind==='ReaderRecoveryAction'&&element.args[0].includes('刷新当前目录'));assert.ok(refresh>=0);directoryRow.elements.splice(refresh,1);
assert.throws(()=>verifyArchitectureRegistration(incompleteDirectory,baseline,contract,root),/retained recovery input\/identity\/callback bindings changed/,'original3 recovery actors cannot hide missing confirmed refresh failure surface');
const privateDirectory=structuredClone(inventory);privateDirectory.rows.find(row=>row.file===directoryRow.file).elements.find(element=>element.kind==='ReaderRecoveryAction').args[0]=privateDirectory.rows.find(row=>row.file===directoryRow.file).elements.find(element=>element.kind==='ReaderRecoveryAction').args[0].replace('{ label:', '{ fontSize: 99, label:');
assert.throws(()=>verifyArchitectureRegistration(privateDirectory,baseline,contract,root),/illegal retained shared input/,'new business recovery does not grant private style inputs');
const swappedCallback=structuredClone(inventory);const replay=swappedCallback.rows.find(row=>row.file===directoryRow.file).elements.find(element=>element.kind==='ReaderRecoveryAction'&&element.args[0].includes('核对原操作回执'));
replay.args[0]=replay.args[0].replace('this.recover(identity, false)','this.recover(identity, true)');
assert.throws(()=>verifyArchitectureRegistration(swappedCallback,baseline,contract,root),/retained recovery input\/identity\/callback bindings changed/,'a pure inspect label cannot silently become replaying dispatch');
const droppedIdentity=structuredClone(inventory);const stale=droppedIdentity.rows.find(row=>row.file===directoryRow.file).elements.find(element=>element.kind==='ReaderRecoveryAction');
stale.args[0]=stale.args[0].replace('this.ownsRecovery(identity)','true');
assert.throws(()=>verifyArchitectureRegistration(droppedIdentity,baseline,contract,root),/retained recovery input\/identity\/callback bindings changed/,'captured recovery identity is an actual input contract');
const arbitrarySlot=structuredClone(contract);arbitrarySlot.retainedConsumerSlots[0].file='entry/src/main/ets/features/common/UnknownHeader.ets';
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,arbitrarySlot,root),/no UI-path wildcard or new producer exemption/);
const realActionSource=readFileSync('entry/src/main/ets/features/common/ReaderRecoveryAction.ets','utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file.endsWith('/ReaderRecoveryAction.ets')?realActionSource.replace('.height(36)', '.height(99)'):readFileSync(file,'utf8')),/actual shared delegate implementation changed|retained shared child interface\/implementation changed/,'shared interface/geometry cannot change behind an input-only registration');
const cardRow=inventory.rows.find(row=>row.file==='features/sync/SyncPage.ets');
const originalCardCall=cardRow.elements.find(e=>e.kind==='ReaderCard');assert.ok(originalCardCall);
for(const property of ['radius','bg','cardBorder']){
 const negative=structuredClone(inventory),call=negative.rows.find(r=>r.file===cardRow.file).elements.find(e=>e.kind==='ReaderCard');
 call.args[0]=call.args[0].replace('{ specId:', '{ '+property+': 99, specId:');
 assert.throws(()=>verifyArchitectureRegistration(negative,baseline,contract,root),/illegal shared input shared-ReaderCard/,'removed appearance prop '+property+' cannot bypass finite Card contract');
}
const wrongVariant=structuredClone(inventory),wrongCard=wrongVariant.rows.find(r=>r.file===cardRow.file).elements.find(e=>e.kind==='ReaderCard');
wrongCard.args[0]=wrongCard.args[0].replace("'sync-config'","'private99'");
assert.throws(()=>verifyArchitectureRegistration(wrongVariant,baseline,contract,root),/producer\/consumer\/spec edges changed/,'unknown finite Card spec rejected');
const overridden=structuredClone(inventory);overridden.rows.find(r=>r.file===cardRow.file).elements.find(e=>e.kind==='ReaderCard').modifiers.push({property:'borderRadius',args:['99']});
assert.throws(()=>verifyArchitectureRegistration(overridden,baseline,contract,root),/caller privately overrides shared appearance/);
for(const property of ['width','height','constraintSize','padding']){const shapeOverride=structuredClone(inventory);shapeOverride.rows.find(r=>r.file===cardRow.file).elements.find(e=>e.kind==='ReaderCard').modifiers.push({property,args:['99']});assert.throws(()=>verifyArchitectureRegistration(shapeOverride,baseline,contract,root),/caller privately overrides shared appearance/,'Card geometry goes through measured cardWidth, no outer '+property+' override');}
const copiedMode=structuredClone(contract);copiedMode.producers.find(p=>p.component==='ReaderButton').registrationKind='legacy-business-budget';
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,copiedMode,root),/only the exact existing Card budget/,'Card historical budget policy is not a common-path exemption');
const cardSource=readFileSync('entry/src/main/ets/features/common/ReaderCard.ets','utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file.endsWith('/ReaderCard.ets')?cardSource.replace('.borderRadius(resolveReaderCardSpec(this.specId).radius)', '.borderRadius(99)'):readFileSync(file,'utf8')),/finite shared physical inputs/,'same-count literal99 in actual Card implementation rejected');
console.log('PASS P0 actual UI/finite shared producer gate: 93 unchanged budgets + seven reversible approved transitions, exact producer/spec/consumer/interface/physical-inputs, retained outside100 policy; literal-same-count, wildcard, absent zero-style UI and arbitrary consumer override rejected. SDK proof suites are separate.');

for (const component of ['ReaderToggle','ReaderSegmentedControl']) {
 const originalCall = inventory.rows.flatMap(row=>row.elements.map(element=>({row,element}))).find(x=>x.element.kind===component);
 assert.ok(originalCall);
 const negative = structuredClone(inventory), call = negative.rows.find(row=>row.file===originalCall.row.file).elements.find(element=>element.kind===component);
 call.args[0]=call.args[0].replace('{', '{ radius: 99,');
 assert.throws(()=>verifyArchitectureRegistration(negative,baseline,contract,root), /illegal shared input/, 'free radius cannot return to F04');
 const privateSpec=structuredClone(inventory), bad=privateSpec.rows.find(row=>row.file===originalCall.row.file).elements.find(element=>element.kind===component);
 bad.args[0]=bad.args[0].replace(component==='ReaderToggle'?"'standard-toggle'":"'app-theme-segment'", "'private99'");
 assert.throws(()=>verifyArchitectureRegistration(privateSpec,baseline,contract,root), /producer\/consumer\/spec edges changed/, 'exact finite F04 spec cannot drift');
}
const iconSites=inventory.rows.flatMap(row=>row.elements.filter(element=>element.kind==='ReaderIconButton').map(element=>({row,element})));
assert.equal(iconSites.length,6,'all six actual finite icon consumers registered');
assert.equal(iconSites.filter(site=>site.row.file==='features/reading/ReaderChapterLoadingState.ets').length,1,
  'pending chapter delegates its unique back action to the shared icon control');
for(const {row:site,element:originalCall} of iconSites){
 const index=site.elements.indexOf(originalCall);
 for(const property of ['boxSize','iconSize','radius']){
  const negative=structuredClone(inventory),call=negative.rows.find(row=>row.file===site.file).elements[index];
  call.args[0]=call.args[0].replace('{','{ '+property+': 99,');
  assert.throws(()=>verifyArchitectureRegistration(negative,baseline,contract,root),/illegal shared input/,'removed icon '+property+' cannot bypass finite spec');
 }
 for(const property of ['width','height','padding','constraintSize','responseRegion']){
  const negative=structuredClone(inventory);negative.rows.find(row=>row.file===site.file).elements[index].modifiers.push({property,args:['99']});
  assert.throws(()=>verifyArchitectureRegistration(negative,baseline,contract,root),/caller privately overrides shared appearance/,'outer icon '+property+' cannot bypass finite spec');
 }
 const removed=structuredClone(inventory);removed.rows.find(row=>row.file===site.file).elements.splice(index,1);
 assert.throws(()=>verifyArchitectureRegistration(removed,baseline,contract,root),/producer\/consumer\/spec edges changed/,'each real icon consumer remains registered');
 const privateVariant=structuredClone(inventory),privateCall=privateVariant.rows.find(row=>row.file===site.file).elements[index];
 privateCall.args[0]=privateCall.args[0].replace(/specId:\s*'[^']+'/,"specId: 'private99'");
 assert.throws(()=>verifyArchitectureRegistration(privateVariant,baseline,contract,root),/producer\/consumer\/spec edges changed/,'every finite icon variant is an exact consumer binding');
}
const iconPath='entry/src/main/ets/features/common/ReaderIconButton.ets',iconSource=readFileSync(iconPath,'utf8');
assert.throws(()=>verifyArchitectureRegistration(inventory,baseline,contract,root,file=>file===iconPath?iconSource.replace('.width(resolveReaderIconButtonSpec(this.specId).boxSize)','.width(99)'):readFileSync(file,'utf8')),/finite shared physical inputs/,'same-count literal icon geometry rejected');
