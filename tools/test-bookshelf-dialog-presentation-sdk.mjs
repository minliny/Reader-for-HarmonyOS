import assert from 'node:assert/strict';
import {bookshelfDialogPresentationFixture as fixture,indexSource,defer} from './lib/bookshelf-dialog-presentation-sdk.mjs';
let cases=0;

{
 const f=fixture();let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const first=f.controllers[0],old=f.native();
 assert.ok(old.confirm?.onClick&&old.cancel?.onClick,'real shared Dialog native action nodes');
 assert.equal(first.options.alignment,'center');assert.equal(first.options.customStyle,true);assert.equal(first.options.autoCancel,true);
 assert.deepEqual([...old.surface.nodes.values()].filter(n=>n.type==='Text'&&['取消','移除'].includes(n.create)).map(n=>n.create),['取消','移除']);
 assert.equal(old.b.message,'A');assert.equal(old.surface.specId,'book-removal');
 f.i.dismissBookRemovalDialog();f.i.openBookRemovalDialog('B',()=>b++);const second=f.controllers[1],live=f.native();assert.notEqual(first,second);assert.equal(live.b.message,'B');
 old.confirm.onClick();old.cancel.onClick();first.options.cancel();f.i.dismissBookRemovalDialog(1);f.i.confirmBookRemovalDialog(1);
 assert.equal(a,0);assert.equal(b,0);assert.equal(f.i.bookRemovalDialogOpen,true);assert.equal(second.closes,0);
 live.confirm.onClick();live.confirm.onClick();assert.equal(a,0);assert.equal(b,1);assert.equal(second.closes,1);assert.equal(f.i.bookRemovalDialogOpen,false);
 first.options.cancel();assert.equal(b,1);cases++;
}
for(const retire of['nav','mount','runtime','unmounted']){
 const f=fixture();let writes=0;f.i.openBookRemovalDialog('A',()=>writes++);const old=f.native(),controller=f.controllers[0];
 if(retire==='nav')f.i.navigationGeneration++;if(retire==='mount')f.i.detailShelfAdmissionMount++;
 if(retire==='runtime')f.retire();if(retire==='unmounted')f.i.shelfReceiptRetired=true;
 assert.doesNotThrow(()=>{old.confirm.onClick();old.cancel.onClick();controller.options.cancel();});assert.equal(writes,0);cases++;
}
{
 const f=fixture(),a={sourceId:'s',bookId:'a',group:'old'},b={sourceId:'s',bookId:'b',group:'old'};
 f.i.openShelfGroup(a);const old=f.group();assert.ok(old.select&&old.mask);
 old.mask.onClick();assert.equal(f.i.editingShelfGroupBook,undefined);f.i.openShelfGroup(b);const live=f.group();
 old.mask.onClick();old.select.onClick();await Promise.resolve();assert.equal(f.raw(f.i.editingShelfGroupBook),b);assert.equal(f.writes.length,0);
 live.select.onClick();await Promise.resolve();await Promise.resolve();assert.deepEqual(f.writes,[b]);assert.equal(f.i.editingShelfGroupBook,undefined);assert.equal(f.refresh(),1);cases++;
}
for(const fail of[false,true]){
 const f=fixture(),a={sourceId:'s',bookId:'a'},b={sourceId:'s',bookId:'b'},gate=defer();f.i.openShelfGroup(a);const old=f.group();f.setTask(gate);
 old.select.onClick();await Promise.resolve();assert.equal(f.writes.length,1);f.i.editingShelfGroupBook=undefined;f.i.editingShelfGroupBusy=false;f.i.openShelfGroup(b);
 if(fail)gate.reject(Error('late failure'));else gate.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.raw(f.i.editingShelfGroupBook),b);assert.equal(f.refresh(),0);assert.equal(f.toasts.length,0,'late A cannot toast against B');cases++;
}
{
 const f=fixture(),book={sourceId:'s',bookId:'wrapped',group:'old'};f.i.openShelfGroup(book);
 assert.match(f.output,/__editingShelfGroupBook = new ObservedPropertyObjectPU\(undefined, this, "editingShelfGroupBook"\)/);
 assert.notEqual(f.i.editingShelfGroupBook,book,'real V1 State wraps the caller raw object');assert.equal(f.raw(f.i.editingShelfGroupBook),book);
 // The non-null assertion is preserved in this SDK Builder argument. The
 // failing raw/proxy seam is openShelfGroup(raw) -> State -> Host bind closure.
 assert.match(f.output,/shelfGroupSurface\.bind\(this\)[^\n]*this\.editingShelfGroupBook!/);
 assert.deepEqual(f.bindings.map(b=>b.accepted),[true]);assert.deepEqual(f.opens,[f.i.bookshelfManagementPresentationIdentity]);
 assert.equal(f.i.isCurrentShelfGroup(f.i.editingShelfGroupPresentation,1,f.r,1,book),true,'same exact entity admits either raw or State view');
 const live=f.group();live.mask.onClick();assert.equal(f.i.editingShelfGroupBook,undefined);assert.equal(f.writes.length,0);cases++;
}
for(const variant of['same-book','same-id-other-source']){
 const f=fixture(),a={sourceId:'s',bookId:'same'},b={sourceId:variant==='same-book'?'s':'other',bookId:'same'};
 f.i.openShelfGroup(a);const old=f.group(),opening=f.i.editingShelfGroupPresentation;
 f.i.closeShelfGroup(opening);f.i.openShelfGroup(b);const live=f.group();
 old.mask.onClick();old.select.onClick();await Promise.resolve();assert.equal(f.raw(f.i.editingShelfGroupBook),b);assert.equal(f.writes.length,0);
 if(variant==='same-id-other-source')assert.equal(f.i.isCurrentShelfGroup(f.i.editingShelfGroupPresentation,1,f.r,1,a),false,'compound key distinguishes same bookId from another source');
 live.select.onClick();live.select.onClick();await Promise.resolve();await Promise.resolve();assert.equal(f.writes.length,1);assert.equal(f.raw(f.writes[0]),b);assert.equal(f.i.editingShelfGroupBook,undefined);cases++;
}
for(const fail of[false,true]){
 const f=fixture(),a={sourceId:'s',bookId:'same'},b={...a},gate=defer();f.i.openShelfGroup(a);const old=f.group();f.setTask(gate);
 old.select.onClick();await Promise.resolve();assert.equal(f.writes.length,1);f.i.closeShelfGroup();f.i.editingShelfGroupBusy=false;f.i.openShelfGroup(b);
 if(fail)gate.reject(Error('late same-book failure'));else gate.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.raw(f.i.editingShelfGroupBook),b);assert.equal(f.i.editingShelfGroupBusy,false);assert.equal(f.refresh(),0);assert.equal(f.toasts.length,0);cases++;
}
{
 const stateIdentity='this.editingShelfGroupBook !== undefined &&\n      this.shelfBookKey(this.editingShelfGroupBook) === this.shelfBookKey(book)';
 const managementIdentity='this.editingShelfGroupBook !== undefined && book !== undefined &&\n        this.shelfBookKey(this.editingShelfGroupBook) === this.shelfBookKey(book)';
 assert.ok(indexSource.includes(stateIdentity)&&indexSource.includes(managementIdentity),'both production guards use the existing compound key');
 const original=indexSource.replace(stateIdentity,'this.editingShelfGroupBook === book').replace(managementIdentity,'this.editingShelfGroupBook === book');
 const f=fixture(original),book={sourceId:'s',bookId:'raw-caller'};f.i.openShelfGroup(book);
 assert.notEqual(f.i.editingShelfGroupBook,book);assert.equal(f.raw(f.i.editingShelfGroupBook),book);
 assert.deepEqual(f.bindings.map(b=>b.accepted),[false]);assert.deepEqual(f.opens,[]);assert.equal(f.i.bookshelfManagementPresentationIdentity,'');
 const blocked=f.group();blocked.select.onClick();blocked.mask.onClick();await Promise.resolve();assert.equal(f.writes.length,0);assert.equal(f.raw(f.i.editingShelfGroupBook),book,'original two reference guards reproduce inert group dialog');cases++;
 // Independent group guard negative control: it rejects the captured raw book
 // even after correct Host binding; the current Builder keeps the proxy view.
 const onlyGroup=fixture(indexSource.replace(stateIdentity,'this.editingShelfGroupBook === book'));onlyGroup.i.openShelfGroup(book);
 assert.deepEqual(onlyGroup.bindings.map(b=>b.accepted),[true]);assert.equal(onlyGroup.i.isCurrentShelfGroup(onlyGroup.i.editingShelfGroupPresentation,1,onlyGroup.r,1,book),false);cases++;
}
{
 const begin=indexSource.indexOf('  private isCurrentBookRemoval('),end=indexSource.indexOf('\n  private openBookRemovalDialog(',begin);
 const mutant=indexSource.slice(0,begin)+'  private isCurrentBookRemoval(): boolean { return true; }\n'+indexSource.slice(end);
 const f=fixture(mutant);let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const old=f.native();f.i.dismissBookRemovalDialog();f.i.openBookRemovalDialog('B',()=>b++);
 // The captured ID at dispatch is independently necessary. Removing only
 // broad runtime/nav admission must not let a wrong-opening native callback act.
 old.confirm.onClick();old.cancel.onClick();assert.equal(a,0);assert.equal(b,0);assert.equal(f.i.bookRemovalDialogOpen,true);cases++;
}
{
 const begin=indexSource.indexOf('  private isCurrentBookRemoval('),end=indexSource.indexOf('\n  private openBookRemovalDialog(',begin);
 let mutant=indexSource.slice(0,begin)+'  private isCurrentBookRemoval(): boolean { return true; }\n'+indexSource.slice(end);
 mutant=mutant.replaceAll('this.confirmBookRemovalDialog(presentation)','this.confirmBookRemovalDialog()').replaceAll('this.dismissBookRemovalDialog(presentation)','this.dismissBookRemovalDialog()');
 const f=fixture(mutant);let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const old=f.native();f.i.dismissBookRemovalDialog();f.i.openBookRemovalDialog('B',()=>b++);
 old.confirm.onClick();assert.equal(a,0);assert.equal(b,1,'original mutable-confirm negative control makes old physical A confirm current B');cases++;
}
{
 const begin=indexSource.indexOf('  private isCurrentShelfGroup('),end=indexSource.indexOf('\n  private async assignShelfDefaultGroup(',begin);
 const mutant=indexSource.slice(0,begin)+'  private isCurrentShelfGroup(): boolean { return true; }\n'+indexSource.slice(end);
 const doubleMutant=mutant.replace('if (presentation !== this.editingShelfGroupPresentation) return;', '');
 const f=fixture(doubleMutant),a={sourceId:'s',bookId:'a'},b={sourceId:'s',bookId:'b'};
 f.i.openShelfGroup(a);const old=f.group();f.i.editingShelfGroupBook=undefined;f.i.openShelfGroup(b);old.mask.onClick();
 assert.equal(f.i.editingShelfGroupBook,undefined,'removing both presentation and close-token guards lets old mask close current B');cases++;
}
console.log(`PASS ${cases} actual Index native Controller→BookRemovalDialog→shared Dialog Button and group Selector/Mask SDK: opening A/B, current once, old confirm/cancel/late native close, exact runtime/nav/mount, late assignment delivery; original geometry/action order retained.`);
