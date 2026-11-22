import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { popupRenderAcknowledged, popupRenderArgs, popupRenderBaselineAcknowledged, popupRenderBaselineArgs,
  popupRenderJournal, preparePopupRender, readPopupRender } from '../lib/popup-render.mjs';

const pid = 13312;
const rsId = index => ((BigInt(pid) << 32n) + BigInt(index)).toString();
const open = {op:'popupRenderOpen',x:1103,y:265};
const close = {op:'popupRenderClose'};

function tree(visible) {
  const row = (depth,type,id,name,properties='',fields='') =>
    ' '.repeat(depth)+`| ${type}_NODE[${rsId(id)}], instanceRootNodeId[${rsId(1)}], ${fields}` +
    `VsyncId: 310000, Properties: ${properties} RSUIContextToken: [ ${rsId(1)} ], nodeName: [${name}]`;
  const bounds = 'Bounds[0 0 1280 2832] Frame[0 0 1280 2832]';
  const reader = [
    row(40,'SURFACE',1,'',bounds,'abilityState: foreground, Name [minliny0], Visible: 1, '),
    row(42,'ROOT',2,'',bounds),
    row(44,'CANVAS',3,'reader-control-module-home'),
    row(44,'CANVAS',4,'reader-control-more'),
    ...(visible ? [
      row(44,'CANVAS',5,'',bounds+' ClipToFrame[True] Alpha[1.000]'),
      row(46,'CANVAS',6,'reader-control-more-menu','Bounds[600 200 600 400] Frame[600 200 600 400] ClipToFrame[True]'),
    ] : []),
  ];
  return reader.join('\n')+'\n';
}

function run(operation, before, after) {
  const directory = mkdtempSync(join(tmpdir(),'reader-popup-test.'));
  try {
    const baseline = join(directory,'before');
    const terminal = join(directory,'after');
    writeFileSync(baseline,before);
    writeFileSync(terminal,after);
    const action = join(directory,'action');
    const shell = String.raw`
pidof() { echo 13312; }
hidumper() { if test -f "$fixture_action"; then cat "$fixture_after"; else cat "$fixture_before"; fi; }
uitest() { touch "$fixture_action"; echo 'No Error'; }
date() { if test -f "$fixture_action"; then echo 1795279192936492514; else echo 1795279192769240556; fi; }
sleep() { :; }
`;
    const execute = args => spawnSync('/bin/bash',['-c',shell+args],{encoding:'utf8',timeout:5000,
      env:{...process.env,fixture_action:action,fixture_before:baseline,fixture_after:terminal}});
    const preflight = execute(popupRenderBaselineArgs[1]);
    assert.equal(preflight.status,0,preflight.stderr);
    const baselineOutput = popupRenderJournal(preflight.stdout);
    assert(popupRenderBaselineAcknowledged(baselineOutput));
    assert(!readdirSync(directory).includes('action'),'a baseline command must never dispatch an input');
    const prepared = preparePopupRender(baselineOutput,operation);
    if (!prepared.operation) return {baselineOutput,reason:prepared.reason,acted:false};
    const args = popupRenderArgs(prepared.operation)[1].replace('/data/local/tmp/reader-popup.XXXXXXXX',join(directory,'slots.XXXXXXXX'));
    const result = execute(args);
    const files = readdirSync(directory);
    assert(!files.some(name=>name.startsWith('slots.')),'temporary capture slots must be removed');
    return {baselineOutput,prepared,status:result.status,stderr:result.stderr,
      stdout:popupRenderJournal(result.stdout),acted:files.includes('action')};
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}

test('Popup render capture preserves the real closed and visible Reader baselines before a single input',()=>{
  for (const [operation,visible] of [[open,false],[close,true]]) {
    const result = run(operation,tree(visible),tree(!visible));
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.acted,true);
    assert(popupRenderAcknowledged(result.stdout));
    const capture = readPopupRender(result.stdout,result.prepared.operation,result.prepared.sample);
    assert.equal(capture.samples.length,37);
    assert.equal(capture.samples[0].home,rsId(3));
    assert.equal(capture.samples[0].menu,visible ? rsId(6) : null);
    assert.equal(capture.samples.at(-1).menu,visible ? null : rsId(6));
    const partial = result.stdout.replace('RS_SAMPLE 30 END','RS_SAMPLE 30 UNAVAILABLE\nRS_SAMPLE 30 END');
    assert.equal(readPopupRender(partial,result.prepared.operation,result.prepared.sample).samples[30],null);
    assert.match(popupRenderArgs(result.prepared.operation)[1],/hidumper -s RenderService -a RSTree \|\| printf/u,
      'RenderService must use the direct device stdout');

  }
});

test('Popup render capture refuses an empty, alien or wrong-state baseline before dispatch',()=>{
  for (const [operation,before] of [[open,''],[open,tree(true)],[close,tree(false)],
    [open,tree(false).replaceAll(/\[(\d{14})\]/g,(_,id)=>'['+(BigInt(id)+(1n<<32n))+']')]]) {
    const result = run(operation,before,tree(true));
    assert.equal(result.acted,false);
    assert.match(result.reason,/RenderService baseline/u);
    assert.match(result.baselineOutput,/RS_SAMPLE 0 BEGIN/u);
    assert.doesNotMatch(result.baselineOutput,/RS_ACTION BEGIN/u);
  }
});
