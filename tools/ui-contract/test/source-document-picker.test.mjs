import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { captureRecord, nativeBounds, normalReaderWindowRoots, sha256 } from '../../lib/native-ui-evidence.mjs';
import { assertCurrentActionState, normalizeSample, requestedOperation, requireActionDispatch, sampleReadiness }
  from '../collectors/harmonyos/records.mjs';
import { fixtureAdmission } from '../collectors/harmonyos/run.mjs';
import { loadCase } from '../lib/cases.mjs';
import { sourcePickerAnchor, sourcePickerCase, sourcePickerGuard, sourcePickerTarget } from '../lib/source-document-picker.mjs';

const archive = process.env.READER_SOURCE_PICKER_ARCHIVE;
const expected = {windowId:'72',displayId:'0',fileName:'Reader Phase 1 public sources.json'};
const captures = {
  browse: ['fixture-import-browse.WFv0Cq','reader-control-8c02b21a-b518-4cf4-a868-17c5b4ce00ed.json'],
  phone: ['fixture-import-storage-direct.zeFsSs','reader-control-ef030d13-ffc4-40ac-8768-7f8932d138d4.json'],
  downloads: ['fixture-import-downloads.VNy26I','reader-control-8881ae07-b795-437b-b5a1-73e9a785bff8.json'],
  file: ['fixture-import-source-select.BUo40Z','reader-control-4f6b172a-29a6-4fba-9f1d-15a5bd444792.json'],
};
const postPicker = 'reader-control-adbefedc-c649-4e90-a72e-2534d2719383.json';
const readTree = (directory,file) => JSON.parse(readFileSync(join(archive,directory,file),'utf8'));

test('native source document picker locates only the exact public JSON carrier in an observed same-window flow',
  {skip: !archive && 'Set READER_SOURCE_PICKER_ARCHIVE to the historical Phase 1 evidence directory'}, () => {
    const transfer = JSON.parse(readFileSync(join(archive,'PUBLIC-SOURCE-TRANSFER.json'),'utf8'));
    assert.equal(transfer.fixture,expected.fileName);
    for (const [operation,[directory,file]] of Object.entries(captures)) {
      const paths = readdirSync(join(archive,directory)).filter(path=>path.endsWith('.jsonl'));
      assert.equal(paths.length,1,'each archival step has one historical probe log');
      const commands = readFileSync(join(archive,directory,paths[0]),'utf8').trim().split('\n').map(line=>JSON.parse(line));
      const bytes = readFileSync(join(archive,directory,file));
      const capture = captureRecord(commands,{path:file,sha256:sha256(bytes)},bytes,'dumpLayout');
      assert.equal(commands[capture.entry].targetRef,transfer.targetRef);
      const point = sourcePickerTarget(JSON.parse(bytes),expected,operation);
      assert.equal(point?.operation,operation);
      assert.match(point.carrierPath,/^0(?:\/\d+)+$/u);
      const click = commands.slice(capture.entry+1).find(command=>command.event === 'command' &&
        command.args?.slice(0,4).join(' ') === 'shell uitest uiInput click');
      assert.equal(click?.ok,true);
      assert.deepEqual(click.args.slice(4),[String(point.x),String(point.y)]);
      assert.deepEqual(Object.keys(point),['operation','carrierPath','x','y']);
    }

    const [directory,file] = captures.file;
    const tree = readTree(directory,file);
    assert.equal(sourcePickerTarget(tree,{...expected,displayId:'1'},'file'),null);
    assert.equal(sourcePickerTarget(tree,{...expected,windowId:'73'},'file'),null);
    assert.equal(sourcePickerTarget(tree,{...expected,fileName:'Reader Phase 1.json'},'file'),null);
    assert.equal(sourcePickerTarget(tree,{...expected,fileName:'../Reader Phase 1 public sources.json'},'file'),null);
    assert.equal(sourcePickerTarget(tree,expected,'downloads'),null,'the Download breadcrumb is no longer selectable');
    assert.equal(sourcePickerTarget(readTree(directory,postPicker),expected,'file'),null,'system picker closed after genuine selection');

    const path = sourcePickerTarget(tree,expected,'file').carrierPath.split('/').slice(1).map(Number);
    const parentAt = root => path.slice(0,-1).reduce((node,index)=>node.children[index],root.children[0]);
    const duplicate = structuredClone(tree);
    const grid = parentAt(duplicate);
    grid.children.push(structuredClone(grid.children[path.at(-1)]));
    assert.equal(sourcePickerTarget(duplicate,expected,'file'),null,'ambiguous exact filenames cannot dispatch');

    const clipped = structuredClone(tree);
    const carrier = parentAt(clipped).children[path.at(-1)];
    carrier.attributes.bounds = carrier.attributes.bounds.replace(/^\[56,/u,'[57,');
    assert.equal(sourcePickerTarget(clipped,expected,'file'),null,'a partially visible carrier is not used as a dispatch point');

    const wrongOwner = structuredClone(tree);
    const wrongCarrier = parentAt(wrongOwner).children[path.at(-1)];
    wrongCarrier.attributes.hostWindowId='73';
    assert.equal(sourcePickerTarget(wrongOwner,expected,'file'),null,'a foreign-window GridItem cannot provide the touch carrier');
  });

test('status import requires the pinned document attestation for the exact target', () => {
  const contract = loadCase(sourcePickerCase);
  const candidate = {targetRef:'0123456789ab',targetKind:'vm',hdcServer:'127.0.0.1:8710'};
  const route = {direct:true,routeObservation:'loopback',socketObservation:'connected local socket'};
  const fixture = {schema:'reader-ui-public-fixture-v1',caseId:contract.id,fixtureId:contract.fixture.id,
    targetRef:candidate.targetRef,hdcServer:candidate.hdcServer,vmName:'Public fixture VM',checkedAt:'2026-11-19T00:00:00Z',
    noPersonalData:true,developerMode:true,publicBooks:true,publicInputs:true,publicHistory:true,publicImeCandidates:true,
    publicSources:true,publicInputs:true,publicBookTitleConfirmed:true,directRoute:{clientToServer:route,serverToTarget:route},
    publicDocument:{...contract.fixture.publicDocument,pickerPublic:true}};
  assert.equal(fixtureAdmission(fixture,contract,candidate),Date.parse(fixture.checkedAt));
  assert.throws(() => fixtureAdmission({...fixture,targetRef:'1123456789ab'},contract,candidate),/scope-matched/u);
  for (const fields of [{sha256:'a'.repeat(64)},{pickerPublic:false},{basename:'another.json'},{folder:'/private'}]) {
    assert.throws(() => fixtureAdmission({...fixture,publicDocument:{...fixture.publicDocument,...fields}},contract,candidate),
      /selected data roles/u);
  }
  const unrelated = loadCase('source-management.empty-library');
  assert.throws(() => fixtureAdmission({...fixture,caseId:unrelated.id,fixtureId:unrelated.fixture.id},unrelated,candidate),
    /selected data roles/u);
});

test('status import normalizes an archived picker only as a fresh, replay-checked action locator',
  {skip: !archive && 'Set READER_SOURCE_PICKER_ARCHIVE to the historical Phase 1 evidence directory'}, () => {
    const [directory,file] = captures.file;
    const bytes = readFileSync(join(archive,directory,file));
    const tree = JSON.parse(bytes);
    const paths = readdirSync(join(archive,directory)).filter(path=>path.endsWith('.jsonl'));
    assert.equal(paths.length,1);
    const archived = readFileSync(join(archive,directory,paths[0]),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    const ref = {path:file,bytes:bytes.length,sha256:sha256(bytes)};
    const capture = captureRecord(archived,ref,bytes,'dumpLayout');
    assert.equal(capture.entry-capture.capture,2);
    const records = [{},...archived.slice(capture.capture,capture.entry+1)];
    const store = {bytes: input => {assert.deepEqual(input,ref); return bytes;}};
    const [root] = normalReaderWindowRoots(tree);
    const [left,top,right,bottom] = nativeBounds(root.attributes.origBounds);
    const density = 3.5;
    const size = {width:(right-left)/density,height:(bottom-top)/density};
    const report = {windowId:expected.windowId,vpPixels:density,metrics:{ready:true,revision:1,densityPixels:density,
      windowRect:{left:0,top:0,...size},globalRect:{left:left/density,top:top/density,...size},
      keyboardArea:{available:true,visible:false,rects:[]},keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
    const mark = {instanceId:'instance',eventSeq:10,semanticSeq:9,deviceMonoMs:1000,windowRevision:1,kind:'window-stable',
      payload:{report,windowId:expected.windowId,orientation:'portrait'}};
    const after = {...mark,eventSeq:11,deviceMonoMs:1050};
    const target = sourcePickerAnchor('file');
    const locate = {id:'picker-file',kind:'locate',anchors:[target],captureGuard:sourcePickerGuard};
    const action = {id:'select-source-file',from:locate.id,op:'click',target};
    const entry = {id:locate.id,kind:locate.kind,beforeLog:1,floorLog:5,layout:ref,hostBeginMs:20,hostEndMs:21};
    const fixture = {publicDocument:{basename:expected.fileName}};
    const locator = normalizeSample({store,records,entry,before:mark,after,refs:[],fixture,step:locate});
    assert.equal(sampleReadiness(locate,locator),null);
    assert.equal(locator.captureComplete,false);
    assert.equal(locator.nodes,undefined);
    assert.equal(JSON.stringify(locator).includes(expected.fileName),false);
    const immediate = {...after,eventSeq:12,deviceMonoMs:1100};
    assertCurrentActionState(action,locator,immediate);
    assert.throws(() => assertCurrentActionState(action,locator,{...immediate,deviceMonoMs:3600}),/stale/u);
    assert.throws(() => requestedOperation({...action,target:sourcePickerAnchor('phone')},{[locate.id]:locator},fixture),
      /matching current/u);
    const operation = requestedOperation(action,{[locate.id]:locator},fixture);
    const raw = archived.slice(capture.entry+1).find(command=>command.args?.slice(0,4).join(' ') === 'shell uitest uiInput click');
    assert.equal(requireActionDispatch([raw],1,operation),raw);
    assert.throws(() => requireActionDispatch([raw],1,{...operation,x:operation.x+1}),/Unexpected command/u);
  });
