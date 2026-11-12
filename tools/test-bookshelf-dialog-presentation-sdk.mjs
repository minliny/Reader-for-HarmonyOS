import assert from 'node:assert/strict';
import {bookshelfDialogPresentationFixture as fixture,indexSource,groupPresentationSource,removalHostSource,defer} from './lib/bookshelf-dialog-presentation-sdk.mjs';
let cases=0;
const groupOnly=process.argv.includes('--group-only');
function ignoreRemovalAdmission(source) {
 const open=source.indexOf('  private openBookRemovalDialog(');
 const begin=source.indexOf('    const current =',open),end=source.indexOf('    this.bookRemovalConfirmation.open(',begin);
 return source.slice(0,begin)+'    const current = (): boolean => true;\n'+source.slice(end);
}

if(!groupOnly){
 const f=fixture();let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const first=f.controllers[0],old=f.native();
 assert.ok(old.confirm?.onClick&&old.cancel?.onClick,'real shared Dialog native action nodes');
 assert.equal(first.options.alignment,'center');assert.equal(first.options.customStyle,true);assert.equal(first.options.autoCancel,true);
 assert.deepEqual([...old.surface.nodes.values()].filter(n=>n.type==='Text'&&['取消','移除'].includes(n.create)).map(n=>n.create),['取消','移除']);
 assert.equal(old.b.message,'A');assert.equal(old.surface.specId,'book-removal');
 f.i.bookRemovalConfirmation.dismiss();f.i.openBookRemovalDialog('B',()=>b++);const second=f.controllers[1],live=f.native();assert.notEqual(first,second);assert.equal(live.b.message,'B');
 old.confirm.onClick();old.cancel.onClick();first.options.cancel();f.i.bookRemovalConfirmation.dismiss(1);f.i.bookRemovalConfirmation.confirm(1);
 assert.equal(a,0);assert.equal(b,0);assert.equal(f.i.bookRemovalConfirmation.isOpen(),true);assert.equal(second.closes,0);
 live.confirm.onClick();live.confirm.onClick();assert.equal(a,0);assert.equal(b,1);assert.equal(second.closes,1);assert.equal(f.i.bookRemovalConfirmation.isOpen(),false);
 first.options.cancel();assert.equal(b,1);cases++;
}
if(!groupOnly)for(const retire of['nav','mount','runtime','unmounted']){
 const f=fixture();let writes=0;f.i.openBookRemovalDialog('A',()=>writes++);const old=f.native(),controller=f.controllers[0];
 if(retire==='nav')f.i.navigationGeneration++;if(retire==='mount')f.i.detailShelfAdmissionMount++;
 if(retire==='runtime')f.retire();if(retire==='unmounted')f.i.shelfReceiptRetired=true;
 assert.doesNotThrow(()=>{old.confirm.onClick();old.cancel.onClick();controller.options.cancel();});assert.equal(writes,0);cases++;
}
{
 const f=fixture(),a={sourceId:'s',bookId:'a',group:'old'},b={sourceId:'s',bookId:'b',group:'old'};
 f.i.openShelfGroup(a);const old=f.group();assert.ok(old.select&&old.mask);
 assert.equal(old.select.type,'Button','actual default choice is a native Button');
 assert.deepEqual(old.select.padding,{left:12,right:12,top:5,bottom:5});
 assert.deepEqual(old.select.constraintSize,{minWidth:0,minHeight:0},'choice keeps its natural authored size');
 assert.equal(old.select.borderRadius,999);assert.equal(old.select.id,old.child.focusId);
 const label=[...old.child.nodes.values()].find(n=>n.type==='Text'&&n.create==='默认');
 assert.ok(label);assert.equal(label.onClick,undefined,'label only paints the choice');
 old.mask.onClick();assert.equal(f.presentation.book,undefined);f.i.openShelfGroup(b);const live=f.group();
 old.mask.onClick();old.select.onClick();await Promise.resolve();assert.equal(f.raw(f.presentation.book),b);assert.equal(f.writes.length,0);
 live.select.onClick();await Promise.resolve();await Promise.resolve();assert.deepEqual(f.writes,[b]);assert.equal(f.presentation.book,undefined);assert.equal(f.refresh(),1);cases++;
}
for(const fail of[false,true]){
 const f=fixture(),a={sourceId:'s',bookId:'a'},b={sourceId:'s',bookId:'b'},gate=defer();f.i.openShelfGroup(a);const old=f.group();f.setTask(gate);
 old.select.onClick();await Promise.resolve();assert.equal(f.writes.length,1);f.presentation.retire();f.i.openShelfGroup(b);
 if(fail)gate.reject(Error('late failure'));else gate.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.raw(f.presentation.book),b);assert.equal(f.refresh(),0);assert.equal(f.toasts.length,0,'late A cannot toast against B');cases++;
}
for(const source of ['s','other']){
 const f=fixture(),a={sourceId:'s',bookId:'same'},b={sourceId:source,bookId:'same'};
 f.i.openShelfGroup(a);const old=f.group(),opening=f.presentation.identity;
 f.presentation.dismiss(opening);f.i.openShelfGroup(b);const live=f.group();
 assert.notEqual(f.presentation.identity,opening);
 assert.deepEqual(f.bindings.map(binding=>binding.accepted),[true,true]);
 assert.deepEqual(f.opens,[opening,f.presentation.identity]);
 old.mask.onClick();old.select.onClick();await Promise.resolve();assert.equal(f.raw(f.presentation.book),b);assert.equal(f.writes.length,0);
 live.select.onClick();live.select.onClick();await Promise.resolve();await Promise.resolve();
 assert.equal(f.writes.length,1);assert.equal(f.raw(f.writes[0]),b);assert.equal(f.presentation.book,undefined);cases++;
}
{
 const f=fixture(),book={sourceId:'s',bookId:'pending'};f.i.openShelfGroup(book);
 const gate=defer();f.setTask(gate);f.group().select.onClick();
 const busy=f.group().select;assert.equal(busy.enabled,false);busy.onClick();assert.equal(f.writes.length,1);
 assert.equal(f.presentation.back(),true);assert.equal(f.raw(f.presentation.book),book,'Back consumes a busy group opening without cancelling its write');
 gate.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.presentation.book,undefined);assert.equal(f.refresh(),1);cases++;
}
if(!groupOnly){
 const mutant=ignoreRemovalAdmission(indexSource);
 const f=fixture(mutant);let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const old=f.native();f.i.bookRemovalConfirmation.dismiss();f.i.openBookRemovalDialog('B',()=>b++);
 // The captured ID at dispatch is independently necessary. Removing only
 // broad runtime/nav admission must not let a wrong-opening native callback act.
 old.confirm.onClick();old.cancel.onClick();assert.equal(a,0);assert.equal(b,0);assert.equal(f.i.bookRemovalConfirmation.isOpen(),true);cases++;
}
if(!groupOnly){
 const mutant=removalHostSource.replace('presentation.confirm(id)', 'presentation.confirm()');
 assert.notEqual(mutant, removalHostSource);
 const f=fixture(ignoreRemovalAdmission(indexSource),undefined,groupPresentationSource,mutant);let a=0,b=0;f.i.openBookRemovalDialog('A',()=>a++);const old=f.native();f.i.bookRemovalConfirmation.dismiss();f.i.openBookRemovalDialog('B',()=>b++);
 old.confirm.onClick();assert.equal(a,0);assert.equal(b,1,'original mutable-confirm negative control makes old physical A confirm current B');cases++;
}
{
 const candidate=groupPresentationSource.replace('opening.identity === identity && this.identity === identity &&','');
 assert.notEqual(candidate,groupPresentationSource);
 const f=fixture(indexSource,undefined,candidate),a={sourceId:'s',bookId:'a'},b={sourceId:'s',bookId:'b'};
 f.i.openShelfGroup(a);const old=f.group();f.presentation.retire();f.i.openShelfGroup(b);old.mask.onClick();
 assert.equal(f.raw(f.presentation.book),b,'the shared Host still refuses the retired opening');cases++;
}
console.log(`PASS ${cases} ${groupOnly?'phone group Journey→Presentation→Dialog→native default choice':'actual Index native Controller→BookRemovalDialog→shared Dialog Button and group Selector/Mask'} SDK: current once, stale opening/late delivery rejection and original geometry/action order retained.`);
