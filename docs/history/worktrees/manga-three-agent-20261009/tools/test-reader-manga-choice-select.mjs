import assert from 'node:assert/strict';
import {MANGA_DIRECTORY_VISUAL,mangaDirectoryColor} from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import {choiceSheetAnchor,choiceSheetOwner,choiceSheetRows,readerMangaChoiceSelectProbe} from './lib/reader-manga-choice-select-probe.mjs';

function render(height=852) {
  const probe=readerMangaChoiceSelectProbe();
  probe.metrics.windowRect.height=height;
  probe.metrics.windowRect.width=390;
  probe.metrics.navigationInsets.bottom=12;
  probe.metrics.gestureInsets.bottom=0;
  const commits=[],dismissals=[];
  const owner=choiceSheetOwner(probe,{options:['第一项','第二项','第三项'],selectedIndex:1,value:'第二项',
    title:'选择项目',variant:'source-tools',selectionToken:'owner:1',scheme:'day',openOnMount:true,
    visible:true,
    onSelect:(index,value,token)=>commits.push({index,value,token}),onDismiss:token=>dismissals.push(token)});
  return{probe,owner,commits,dismissals};
}

for(const height of [852,130]) {
  const f=render(height),anchor=choiceSheetAnchor(f.probe,f.owner);
  assert.ok(anchor,'real production SDK component owns the sheet');
  assert.equal(anchor.bindSheet[0],true);
  const sheet=anchor.bindSheet[2];
  assert.equal(sheet.preferType,'SheetType.BOTTOM');
  assert.equal(sheet.dragBar,false);
  assert.equal(sheet.showClose,false);
  assert.equal(sheet.backgroundColor,mangaDirectoryColor('surface','day'));
  assert.equal(sheet.maskColor,mangaDirectoryColor('scrim','day'));
  assert.equal(sheet.radius.topLeft,MANGA_DIRECTORY_VISUAL.quickSheetRadius);
  const maximum=Math.min(height-12,Math.round((height-12)*0.78));
  assert.ok(sheet.height<=maximum,'sheet honors the responsive viewport ceiling');
  assert.ok(f.owner.sheetBodyHeight()>=0,'small viewports retain a bounded, scrollable body');
  anchor.bindSheet[1]();f.probe.rows.properties.flush();
  const options=choiceSheetRows(f.probe,f.owner);
  assert.equal(options.length,3,'actual option rows are mounted as ReaderChoiceRow children');
  assert.equal(options.find(row=>row.label==='第二项').selected,true);
  const oldRow=options.find(row=>row.label==='第一项');
  const oldClick=[...oldRow.nodes.values()].find(node=>node.onClick).onClick;
  const oldDismiss=anchor.bindSheet[2].onDisappear;
  oldClick();assert.deepEqual(f.commits,[{index:0,value:'第一项',token:'owner:1'}]);
  assert.equal(f.owner.sheetVisible,false);

  f.owner.openSheet();f.owner.replay();
  const reopened=choiceSheetAnchor(f.probe,f.owner);
  assert.equal(reopened.bindSheet[0],true);
  oldClick();oldDismiss();
  assert.equal(f.commits.length,1,'old row action cannot borrow a same-token reopened choice');
  assert.equal(f.owner.sheetVisible,true,'old onDisappear cannot dismiss the reopened sheet');
  f.owner.updateStateVars({selectionToken:'owner:2',visible:true,openOnMount:true,choiceEnabled:true,
    options:['第一项','第二项','第三项'],scheme:'day'});f.probe.rows.properties.flush();
  assert.equal(f.owner.sheetVisible,true,'a live selection identity change opens a fresh sheet epoch');
  assert.equal(choiceSheetAnchor(f.probe,f.owner).bindSheet[0],true);
  f.owner.updateStateVars({selectionToken:'owner:2',visible:true,openOnMount:true,choiceEnabled:true,
    options:['第一项','第二项','第三项'],scheme:'day'});f.probe.rows.properties.flush();
  assert.equal(f.owner.sheetVisible,true,'equal option content in a fresh parent array preserves the open sheet');
  f.owner.updateStateVars({selectionToken:'owner:2',visible:true,openOnMount:true,choiceEnabled:true,
    options:['replacement'],scheme:'day'});f.probe.rows.properties.flush();
  assert.equal(f.owner.sheetVisible,false,'live option replacement retires the old rendered choices');
  [...f.owner.nodes.values()].find(node=>node.onClick).onClick();f.probe.rows.properties.flush();
  assert.equal(f.owner.sheetVisible,true,'the active visible owner can reopen after options refresh');
  assert.equal(choiceSheetAnchor(f.probe,f.owner).bindSheet[0],true,'trigger click updates the actual native bindSheet observer');
  f.owner.updateStateVars({choiceEnabled:false});f.probe.rows.properties.flush();
  assert.equal(f.owner.sheetVisible,false,'live disable closes an open sheet');
  assert.deepEqual(f.dismissals,['owner:2','owner:2']);
}
{
  const probe=readerMangaChoiceSelectProbe(),owner=choiceSheetOwner(probe,{options:['A','B'],selectedIndex:0,value:'A',
    title:'Trigger',variant:'source-tools',selectionToken:'trigger:1',scheme:'day',visible:false,openOnMount:false});
  const anchor=choiceSheetAnchor(probe,owner);assert.equal(anchor.bindSheet[0],false,'inline Select trigger starts closed');
  [...owner.nodes.values()].find(node=>node.onClick).onClick();probe.rows.properties.flush();
  assert.equal(choiceSheetAnchor(probe,owner).bindSheet[0],true,'physical wrapper click opens through the actual observer without owner replay');
}
console.log('PASS actual ReaderMangaChoiceSelect SDK child callbacks, captured epochs, Manga sheet shell, native builder and short-window sizing');
