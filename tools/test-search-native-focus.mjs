import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function fieldClip(){
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { compileTailConsumer } = await import('./lib/foundation-tail-consumer-probe.mjs');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readerEditingSdk } = await import('./lib/reader-editing-sdk-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const selectGeometry = await import('../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts');
  const accessibilitySource = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url), 'utf8');
  const shared = foundationControls();
  const classes = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'ReaderSearchFieldAdapters.ets',
    { FrameCallback: class {}, readerActionTouchRegion: pureModuleProbe(accessibilitySource, 'ReaderActionAccessibility.ets', {},
      ['readerActionTouchRegion']).readerActionTouchRegion },
    ['ReaderSearchInputTarget', 'ReaderSearchFocusFrame']);
  const keyType = { Down: 0, Up: 1 }, keyCode = { KEYCODE_BACK: 2 };
  const frames = [], focuses = [];
  const context = { postFrameCallback: frame => frames.push(frame),
    getFocusController: () => ({ requestFocus: id => focuses.push(id) }) };
  const { Component } = compileTailConsumer(source, boundedMembers(source),
    { ...shared.dependencies, ...classes, ...readerEditingSdk(), ...readerTypographyRoles, ...selectGeometry,
      readerAppColor, DEBUG: false, TextInputController: class {}, KeyType: keyType, KeyCode: keyCode, uiContext: context },
    shared.hooks);
  const variants = [
    { variant: 'bookPanel', id: 'reader-book-search-input', clear: '清空搜索内容' },
    { variant: 'sourceManagement', id: 'reader-source-editor', clear: '清空书源搜索' },
    { variant: 'sourceGroup', id: 'reader-source-group-probe:search', clear: '清空分组搜索' },
    { variant: 'readerDirectory', id: 'reader-control-directory-probe', clear: '清空章节搜索' },
    { variant: 'rssPassive', id: 'reader-rss-search-input', clear: '清空订阅搜索' },
  ];
  for (const { variant, id, clear } of variants) {
    const owner = new Component(undefined, {});
    const events = [];
    let current = true;
    const isBook = variant === 'bookPanel';
    const isDirectory = variant === 'readerDirectory';
    Object.assign(owner, { variant, mode: isBook ? 'submit' : 'live', text: '关键词', placeholder: '搜索',
      clearable: true, focusOnAppear: isBook, bookPanelClearId: 'reader-book-search-clear',
      bookPanelFrameId: 'reader-bookshelf-search-field', directoryFocusId: isDirectory ? id : '',
      fieldWidthVp: variant === 'rssPassive' ? 280 : 0,
      directoryFocusAllowed: isDirectory, editingFocusId: id, editingCurrent: () => current,
      editingHost: { focus: () => events.push('edit'), blur: () => events.push('release') },
      onDirectoryKeyboardBack: id => events.push(id), onTextChange: value => events.push(value),
    });
    owner.aboutToAppear();
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const input = nodes.find(node => node.type === 'TextInput');
    const button = nodes.find(node => node.type === 'Button' && node.accessibilityText === clear);
    assert.equal(input.id, id);
    assert.equal(input.borderRadius, 0, 'native start caret keeps a square clipping boundary');
    if (variant === 'rssPassive') {
      assert.deepEqual([input.fontSize, input.lineHeight, input.halfLeading], [14, 20, true],
        'the live RSS caller uses the RSS-specific line box');
    }
    assert.ok(nodes.some(node => node.type === 'Row' && node.borderRadius > 0), 'outer search field stays round');
    if (isBook) {
      assert.equal(button.id, 'reader-book-search-clear');
      assert.equal(focuses.length, 0);
      frames.shift().onFrame();
      assert.deepEqual(focuses.splice(0), [id], 'initial book focus requests the current editor after the frame');
    }
    assert.equal(button.width, 32);
    assert.equal(button.focusOnTouch, false);
    assert.deepEqual([button.responseRegion.width, button.responseRegion.height], [44, 44]);
    current = false;
    button.onClick();
    assert.deepEqual(events, [], 'an overlay or retired owner cannot clear the underlying draft');
    assert.equal(frames.length, 0);
    current = true;
    button.onClick();
    assert.deepEqual(events.splice(0), ['']);
    if (isBook) {
      current = false;
      frames.shift().onFrame();
      assert.deepEqual(focuses, [], 'a covering overlay cancels deferred clear refocus');
      current = true;
      button.onClick();
      frames.shift().onFrame();
      assert.deepEqual(focuses.splice(0), [id], 'clear refocuses the same editor id when still current');
      assert.deepEqual(events.splice(0), ['']);
    } else {
      assert.equal(frames.length, 0, 'clear does not request a new IME or focus for a live filter');
    }
    input.onEditChange(true);
    if (isDirectory) input.onFocus();
    assert.equal(input.onKeyPreIme({ type: keyType.Up, keyCode: keyCode.KEYCODE_BACK }), false);
    assert.deepEqual(events, ['edit']);
    assert.equal(input.onKeyPreIme({ type: keyType.Down, keyCode: keyCode.KEYCODE_BACK }), false,
      'the editable adapter leaves the Back key to the IME');
    assert.deepEqual(events.splice(0), isDirectory ? ['edit', id, 'release'] : ['edit', 'release']);
    if (isBook) {
      button.onClick();
      assert.deepEqual(events.splice(0), ['']);
      assert.equal(frames.length, 1);
    }
    owner.aboutToDisappear();
    if (isBook) {
      frames.shift().onFrame();
      assert.deepEqual(focuses, [], 'a queued clear cannot restore focus after editor teardown');
    }
    events.length = 0;
    button.onClick();
    assert.deepEqual(events, [], 'a retained clear callback cannot write after editor teardown');
  }
}
async function webFocus(){
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p+'.ets',import.meta.url),'utf8');
const Executor=selectedProductionMethods(new URL('../entry/src/main/ets/platform/network/ArkWebExecutor.ts',import.meta.url),
  'ArkWebExecutor',['isSurfaceCurrent','cancelInteractive','finishInteractive','cancel','hostFailure','rejectResourceCapture','emitDiagnostic']);
const executor=new Executor();executor.jobs=new Map();
let stops=0;
const surface={id:1,requestId:11,controller:{stop(){stops++;}}};
const job={requestId:11,surface,interactive:true,cancelled:false,userFinished:false};
executor.active=job;executor.jobs.set(11,job);executor.surfaceLease={surface,retired:false};
const mount=current=>{
  const probe=createReaderBuilderProbe(read('ui/platform/ArkWebExecutionHost'),['build','surfacesForRender'],
    {ArkWebExecutor:{instance:executor}},{allowEmptyBranchAdmission:true});
  Object.assign(probe.owner,{interactive:false,appThemeScheme:'day',surfaceId:current.id,currentSurface:current,title:'',currentUrl:''});
  return probe.owner;
};
const owner=mount(surface);
owner.initialRender();
const web = [...owner.nodes.values()].find(n => n.type === 'Web');
assert.ok(web);
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
owner.interactive = true; owner.replay();
assert.equal(web.focusable, true); assert.equal(web.focusOnTouch, true,
  'visible source login/captcha remains keyboard-capable');
const buttons=()=>[...owner.nodes.values()].filter(n=>n.type==='Button'&&n.onClick);
const cancel=buttons().find(n=>n.accessibilityText==='取消登录'),finish=buttons().find(n=>n.accessibilityText==='完成登录');
assert.ok(cancel&&finish);assert.equal(cancel.defaultFocus,true);
for(const button of [cancel,finish]){
  assert.equal(button.padding,0);assert.deepEqual(button.constraintSize,{minWidth:0,minHeight:0});
  assert.equal(button.height,undefined,'toolbar action keeps authored natural height');assert.equal(button.borderRadius,0);
}
const toolbar=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.height===56);
assert.ok(toolbar);assert.deepEqual(toolbar.padding,{left:18,right:18});
for(const label of [...owner.nodes.values()].filter(n=>n.type==='Text'&&['取消','完成'].includes(n.create))){
  assert.equal(label.onClick,undefined);assert.equal(label.fontSize,14);assert.equal(label.fontWeight,'FontWeight.Bold');
}
cancel.onClick();cancel.onClick();assert.equal(job.cancelled,true);assert.equal(stops,1,'actual Executor cancels the current surface once');
const next={id:2,requestId:12,controller:{stop(){stops++;}}};
const nextJob={requestId:12,surface:next,interactive:true,cancelled:false,userFinished:false};
executor.active=nextJob;executor.jobs.set(12,nextJob);executor.surfaceLease={surface:next,retired:false};
cancel.onClick();finish.onClick();
assert.equal(nextJob.cancelled,false);assert.equal(nextJob.userFinished,false,'retired toolbar cannot finish the new login');
const current=mount(next);current.interactive=true;current.initialRender();
const live=[...current.nodes.values()].filter(n=>n.type==='Button'&&n.onClick);
live.find(n=>n.accessibilityText==='完成登录').onClick();assert.equal(nextJob.userFinished,true);
live.find(n=>n.accessibilityText==='取消登录').onClick();assert.equal(nextJob.cancelled,false,'finish is not reinterpreted as cancel');
// Replay the retained Web's actual observer only: this SDK fixture records
// attributes, while native toolbar subtree removal remains device evidence.
owner.interactive = false;
owner.replayOnly([[...owner.nodes].find(([,node])=>node===web)[0]]);
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
}
const cases={'field-clip':fieldClip,'web-focus':webFocus};
for(const id of selectContractCases({'field-clip':'Actual search input clipping, clear target, guarded focus, and pre-IME Back','web-focus':'Actual hidden/visible ArkWeb keyboard focus lifecycle'})){await cases[id]();recordContractCasePass(id);}
