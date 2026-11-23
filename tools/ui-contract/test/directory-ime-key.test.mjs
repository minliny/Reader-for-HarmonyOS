import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directoryEditor, observeDirectoryImeHideKey } from '../lib/directory-ime-key.mjs';
import { requestedOperation } from '../collectors/harmonyos/records.mjs';

const box = { left:0, top:0, width:1280, height:2832 };
function fixture() {
  const sample = {
    window:{ id:'122', revision:2, density:3.5, rectPx:box, displayRectPx:box,
      visibleRectPx:{ ...box, height:1733 }, keyboard:{ visible:true, revision:2,
        rectsVp:[{ left:0, top:1733/3.5, width:1280/3.5, height:1099/3.5 }] } },
    nodes:[
      { id:'reader-control-module-directory', visible:true, path:'0/0' },
      { alias:directoryEditor, type:'TextInput', focused:true, enabled:true, visible:true, opacity:1,
        visibleRectPx:{left:233,top:775,width:374,height:105}, path:'0/0/0', parentPath:'0/0' },
    ],
  };
  const key = { attributes:{ id:'KeyHideKbd', key:'KeyHideKbd', hostWindowId:'123',
    bounds:'[1112,1757][1245,1890]', visible:'true', clickable:'true', enabled:'true' } };
  const ime = { attributes:{ bundleName:'com.huawei.hmos.inputmethod', type:'root', hostWindowId:'123',
    visible:'true', bounds:'[0,137][1280,2832]' }, children:[key] };
  const tree = { children:[ime] };
  return { sample, tree, ime, key };
}

test('Directory Hide taps only the measured system IME key for the focused native editor', () => {
  const evidence = fixture();
  const key = observeDirectoryImeHideKey(evidence);
  assert.deepEqual(key, { x:1178,y:1823,imeWindow:'123',keyId:'KeyHideKbd',bounds:[1112,1757,1245,1890] });
  assert.deepEqual(requestedOperation({id:'directory-soft-ime-hide',op:'tapImeHide',from:'sample'},
    {sample:{...evidence.sample,imeHideKey:key}}, {}), {op:'click',x:1178,y:1823});
});

test('Directory Hide rejects stale, duplicate, clipped, and out-of-window key evidence', () => {
  const evidence = fixture();
  evidence.sample.window.keyboard.revision = 1;
  assert.throws(() => observeDirectoryImeHideKey(evidence), /current measured keyboard/);
  evidence.sample.window.keyboard.revision = 2;
  evidence.ime.children.push({...evidence.key});
  assert.throws(() => observeDirectoryImeHideKey(evidence), /unique enabled IME hide key/);
  evidence.ime.children.pop();
  evidence.key.attributes.bounds = '[1112,1720][1245,1890]';
  assert.throws(() => observeDirectoryImeHideKey(evidence), /inside the measured keyboard/);
  evidence.key.attributes.hostWindowId = '122';
  assert.throws(() => observeDirectoryImeHideKey(evidence), /unique enabled IME hide key/);
});
